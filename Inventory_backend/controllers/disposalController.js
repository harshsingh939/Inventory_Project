const db = require('../db');
const { notifyRagDebouncedReindex } = require('../services/ragIndexNotify');
const { logReturn, logDisposal } = require('../services/assetHistoryLog');

function isMissingTable(err) {
  return (
    err &&
    (err.code === 'ER_NO_SUCH_TABLE' ||
      err.errno === 1146 ||
      String(err.message || '').includes("doesn't exist"))
  );
}

function normalizeRole(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

/** GET /api/disposals — audit list (newest first) */
exports.listDisposals = (req, res) => {
  const sql = `
    SELECT id, former_asset_id, inventory_id, inventory_name, asset_type, brand, model, serial_number,
           assignment_id, user_name, employee_id, department, condition_after, notes, disposed_at
    FROM disposed_items
    ORDER BY disposed_at DESC
  `;
  db.query(sql, (err, rows) => {
    if (err) {
      if (isMissingTable(err)) {
        return res.json([]);
      }
      return res.status(500).json({ message: err.message });
    }
    res.json(rows || []);
  });
};

/**
 * POST /api/disposals
 * Body: { assignment_id, condition_after?, notes? }
 *
 * Transaction: completes the assignment, INSERT into `disposed_items` (snapshot: device, inventory,
 * assignee, condition, notes), DELETE repair rows for that asset, DELETE the row from `assets`.
 * Inventory name/id come from `assets` + `inventories` at dispose time (matches Disposed table UI).
 *
 * Response: { message, assignment_id, disposed_item_id, former_asset_id }
 */
exports.disposeFromAssignment = (req, res) => {
  const actor = req.user || null;
  if (!actor) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const role = normalizeRole(actor.role);
  if (role !== 'admin' && role !== 'repair_authority' && role !== 'vendor') {
    return res.status(403).json({ message: 'Insufficient role' });
  }

  const assignment_id = req.body?.assignment_id;
  const condition_after = req.body?.condition_after != null ? String(req.body.condition_after) : 'Not reusable';
  const notes = req.body?.notes != null ? String(req.body.notes).trim() : null;

  if (!assignment_id) {
    return res.status(400).json({ message: 'assignment_id is required' });
  }

  const selectSql = `
    SELECT
      a.id AS assignment_id,
      a.user_id,
      a.asset_id,
      a.start_time,
      u.name AS user_name,
      u.employee_id,
      u.department,
      ast.asset_type,
      ast.brand,
      ast.model,
      ast.serial_number,
      ast.inventory_id,
      i.name AS inventory_name
    FROM assignments a
    JOIN users u ON a.user_id = u.id
    JOIN assets ast ON a.asset_id = ast.id
    LEFT JOIN inventories i ON ast.inventory_id = i.id
    WHERE a.id = ? AND a.status = 'Active'
  `;

  db.query(selectSql, [assignment_id], (err, rows) => {
    if (err) {
      if (isMissingTable(err)) {
        return res.status(503).json({
          message: 'Disposed items table missing. Run migration 006_disposed_items.sql.',
        });
      }
      return res.status(500).json({ message: err.message });
    }
    if (!rows || !rows.length) {
      return res.status(404).json({ message: 'Active assignment not found' });
    }

    const row = rows[0];
    const asset_id = row.asset_id;
    const invId = row.inventory_id != null ? row.inventory_id : null;
    const invName = row.inventory_name || null;

    const ensureVendorOwnsRepair = (next) => {
      if (role !== 'repair_authority' && role !== 'vendor') return next();
      const authUserId = Number(actor.id);
      const sql = `
        SELECT id
        FROM repairs
        WHERE asset_id = ?
          AND assigned_authority_auth_user_id = ?
        LIMIT 1
      `;
      db.query(sql, [asset_id, authUserId], (vErr, vRows) => {
        if (vErr) return res.status(500).json({ message: vErr.message });
        if (!vRows || !vRows.length) {
          return res.status(403).json({
            message: 'You can only dispose assets that are assigned to your vendor queue.',
          });
        }
        next();
      });
    };

    const insertSql = `
      INSERT INTO disposed_items (
        former_asset_id, inventory_id, inventory_name, asset_type, brand, model, serial_number,
        assignment_id, user_name, employee_id, department, condition_after, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const insertParams = [
      asset_id,
      invId,
      invName,
      row.asset_type,
      row.brand,
      row.model,
      row.serial_number || null,
      assignment_id,
      row.user_name || null,
      row.employee_id || null,
      row.department || null,
      condition_after,
      notes || null,
    ];

    const rollback = (msg, status = 500) => {
      db.query('ROLLBACK', () => res.status(status).json({ message: msg }));
    };

    ensureVendorOwnsRepair(() => {
      db.query('START TRANSACTION', (tErr) => {
        if (tErr) return res.status(500).json({ message: tErr.message });

        db.query(
          `UPDATE assignments SET
          end_time = NOW(),
          working_minutes = TIMESTAMPDIFF(MINUTE, start_time, NOW()),
          condition_after = ?,
          status = 'Completed'
         WHERE id = ? AND status = 'Active'`,
          [condition_after, assignment_id],
          (u1Err, u1Res) => {
            if (u1Err) return rollback(u1Err.message, 500);
            if (!u1Res || u1Res.affectedRows === 0) {
              return rollback('Assignment was not active', 409);
            }

            db.query(insertSql, insertParams, (iErr, iRes) => {
              if (iErr) {
                if (isMissingTable(iErr)) {
                  return rollback(
                    'Disposed items table missing. Run migration 006_disposed_items.sql.',
                    503,
                  );
                }
                return rollback(iErr.message, 500);
              }

              const disposedItemId = iRes?.insertId;

              db.query('DELETE FROM repairs WHERE asset_id = ?', [asset_id], (repErr) => {
                if (
                  repErr &&
                  repErr.code !== 'ER_NO_SUCH_TABLE' &&
                  repErr.errno !== 1146 &&
                  !String(repErr.message || '').includes("doesn't exist")
                ) {
                  return rollback(repErr.message, 500);
                }

                // Clear FK to assets on all assignment rows (history + current) so DELETE assets succeeds.
                // Migration 013 makes asset_id nullable and ON DELETE SET NULL on the FK.
                db.query(
                  'UPDATE assignments SET asset_id = NULL WHERE asset_id = ?',
                  [asset_id],
                  (clrErr) => {
                    if (clrErr) return rollback(clrErr.message, 500);

                    db.query('DELETE FROM assets WHERE id = ?', [asset_id], (u2Err) => {
                      if (u2Err) return rollback(u2Err.message, 500);

                      db.query('COMMIT', (cErr) => {
                        if (cErr) return res.status(500).json({ message: cErr.message });
                        const afterLog = () => {
                          notifyRagDebouncedReindex();
                          res.json({
                            message:
                              'Item logged in disposed_items; asset row removed from assets (repairs cleared) ✅',
                            assignment_id,
                            disposed_item_id: disposedItemId,
                            former_asset_id: asset_id,
                          });
                        };
                        db.query(
                          'SELECT end_time, working_minutes, condition_after, condition_before, status FROM assignments WHERE id = ?',
                          [assignment_id],
                          (qa, aRows) => {
                            if (qa) {
                              return afterLog();
                            }
                            const a = aRows && aRows[0] ? aRows[0] : {};
                            logReturn(
                              db,
                              {
                                assignment_id,
                                asset_id,
                                user_id: row.user_id,
                                user_name: row.user_name,
                                employee_id: row.employee_id,
                                department: row.department,
                                start_time: row.start_time,
                                end_time: a.end_time,
                                working_minutes: a.working_minutes,
                                condition_before: a.condition_before,
                                condition_after: a.condition_after,
                                status: a.status,
                                asset_type: row.asset_type,
                                brand: row.brand,
                                model: row.model,
                                serial_number: row.serial_number,
                              },
                              () => {},
                            );
                            db.query(
                              'SELECT * FROM disposed_items WHERE id = ?',
                              [disposedItemId],
                              (qd, dRows) => {
                                const d = !qd && dRows && dRows[0] ? dRows[0] : null;
                                if (d) {
                                  logDisposal(
                                    db,
                                    {
                                      former_asset_id: asset_id,
                                      assignment_id,
                                      disposed_item_id: disposedItemId,
                                      disposed_at: d.disposed_at,
                                      user_name: d.user_name,
                                      employee_id: d.employee_id,
                                      department: d.department,
                                      condition_after: d.condition_after,
                                      notes: d.notes,
                                      asset_type: d.asset_type,
                                      brand: d.brand,
                                      model: d.model,
                                      serial_number: d.serial_number,
                                      inventory_id: d.inventory_id,
                                      inventory_name: d.inventory_name,
                                    },
                                    () => {},
                                  );
                                }
                                afterLog();
                              },
                            );
                          },
                        );
                      });
                    });
                  },
                );
              });
            });
          },
        );
      });
    });
  });
};
