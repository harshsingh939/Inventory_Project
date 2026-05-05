const db = require('../db');
const { notifyRagDebouncedReindex } = require('../services/ragIndexNotify');

function isMissingTable(err) {
  return (
    err &&
    (err.code === 'ER_NO_SUCH_TABLE' ||
      err.errno === 1146 ||
      String(err.message || '').includes("doesn't exist"))
  );
}

const pickAvailableSql = `
  SELECT a.id FROM assets a
  LEFT JOIN assignments x ON x.asset_id = a.id AND x.status = 'Active'
  WHERE a.inventory_id = ?
    AND x.id IS NULL
    AND COALESCE(LOWER(TRIM(a.status)), 'available') NOT IN ('assigned', 'under repair', 'disposed')
  ORDER BY a.id ASC
  LIMIT 1
`;

const pickByTypeSql = `
  SELECT a.id FROM assets a
  LEFT JOIN assignments x ON x.asset_id = a.id AND x.status = 'Active'
  WHERE LOWER(TRIM(a.asset_type)) = LOWER(TRIM(?))
    AND x.id IS NULL
    AND COALESCE(LOWER(TRIM(a.status)), 'available') NOT IN ('assigned', 'under repair', 'disposed')
  ORDER BY (a.inventory_id IS NULL) DESC, a.id ASC
  LIMIT 1
`;

/** Resolve concrete asset ids: legacy asset rows, else one unit per inventory + per requested asset_type */
function resolveRequestAssetIds(dbConn, requestId, cb) {
  dbConn.query(
    'SELECT asset_id FROM assignment_request_items WHERE request_id = ?',
    [requestId],
    (e3, lines) => {
      if (e3) return cb(e3);
      const fromItems = (lines || []).map((l) => l.asset_id);
      if (fromItems.length) return cb(null, fromItems);

      dbConn.query(
        'SELECT inventory_id FROM assignment_request_inventories WHERE request_id = ?',
        [requestId],
        (e4, invLines) => {
          if (e4 && !isMissingTable(e4)) return cb(e4);
          const invIds =
            e4 && isMissingTable(e4) ? [] : (invLines || []).map((r) => r.inventory_id);

          dbConn.query(
            'SELECT asset_type FROM assignment_request_asset_types WHERE request_id = ?',
            [requestId],
            (e5, typeRows) => {
              if (e5 && !isMissingTable(e5)) return cb(e5);
              const types =
                e5 && isMissingTable(e5) ? [] : (typeRows || []).map((r) => String(r.asset_type || '').trim()).filter(Boolean);

              if (!invIds.length && !types.length) {
                return cb(new Error('No inventories or device types on this request'));
              }

              const acc = [];
              let iIdx = 0;
              const stepInv = () => {
                if (iIdx >= invIds.length) return stepType(0);
                const invId = invIds[iIdx];
                dbConn.query(pickAvailableSql, [invId], (e6, pick) => {
                  if (e6) return cb(e6);
                  if (!pick || !pick.length) {
                    return cb(new Error(`No available asset in inventory #${invId}`));
                  }
                  acc.push(pick[0].id);
                  iIdx += 1;
                  stepInv();
                });
              };
              const stepType = (tIdx) => {
                if (tIdx >= types.length) return cb(null, acc);
                const t = types[tIdx];
                dbConn.query(pickByTypeSql, [t], (e7, pick) => {
                  if (e7) return cb(e7);
                  if (!pick || !pick.length) {
                    return cb(new Error(`No available "${t}" in stock`));
                  }
                  acc.push(pick[0].id);
                  stepType(tIdx + 1);
                });
              };
              stepInv();
            },
          );
        },
      );
    },
  );
}

/**
 * POST /api/assignment-requests
 * body: inventory_ids[], asset_types[] (device category, e.g. Laptop), optional user_message
 * Legacy: asset_ids[] (specific units) — do not mix with inventory/types.
 */
exports.createRequest = (req, res) => {
  const authId = req.user?.id;
  if (!authId) return res.status(401).json({ message: 'Unauthorized' });

  db.query('SELECT id FROM users WHERE auth_user_id = ? LIMIT 1', [authId], (eLink, ureg) => {
    if (eLink) {
      if (eLink.code === 'ER_BAD_FIELD_ERROR') {
        return res.status(503).json({ message: 'Run migration 007: users.auth_user_id column missing' });
      }
      return res.status(500).json({ message: eLink.message });
    }
    if (!ureg || !ureg.length) {
      return res.status(403).json({
        message:
          'Save your employee profile first under Users (name, Employee ID, department). After that you can request assets from My workspace.',
      });
    }

    const { asset_ids, inventory_ids, asset_types, user_message } = req.body || {};

  const invRaw = Array.isArray(inventory_ids) ? inventory_ids : [];
  const invUniq = [...new Set(invRaw.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))];

  const typeRaw = Array.isArray(asset_types) ? asset_types : [];
  const typeUniq = [
    ...new Set(
      typeRaw
        .map((s) => String(s ?? '').trim())
        .filter(Boolean)
        .map((s) => s.slice(0, 200)),
    ),
  ].slice(0, 40);

  const assetRaw = Array.isArray(asset_ids) ? asset_ids : [];
  const assetUniq = [...new Set(assetRaw.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))];

  if (assetUniq.length > 0 && (invUniq.length > 0 || typeUniq.length > 0)) {
    return res.status(400).json({ message: 'Do not mix asset_ids with inventory or type requests' });
  }
  if (invUniq.length === 0 && typeUniq.length === 0 && assetUniq.length === 0) {
    return res.status(400).json({ message: 'Select at least one inventory and/or device type' });
  }

  const msg = user_message != null ? String(user_message).trim().slice(0, 2000) : null;

  const finishRequestInsert = (afterInsert) => {
    db.query('START TRANSACTION', (tErr) => {
      if (tErr) return res.status(500).json({ message: tErr.message });
      db.query(
        'INSERT INTO assignment_requests (auth_user_id, status, user_message) VALUES (?, ?, ?)',
        [authId, 'Pending', msg || null],
        (iErr, ins) => {
          if (iErr) {
            db.query('ROLLBACK', () => {});
            if (isMissingTable(iErr)) {
              return res.status(503).json({ message: 'Run migration 007_workflow_authority_requests.sql' });
            }
            return res.status(500).json({ message: iErr.message });
          }
          const rid = ins.insertId;
          afterInsert(rid, (e2) => {
            if (e2) {
              db.query('ROLLBACK', () => {});
              if (isMissingTable(e2)) {
                return res.status(503).json({
                  message:
                    'Run migrations 008 (inventories) and/or 009 (assignment_request_asset_types) if missing',
                });
              }
              return res.status(500).json({ message: e2.message });
            }
            db.query('COMMIT', (e3) => {
              if (e3) return res.status(500).json({ message: e3.message });
              notifyRagDebouncedReindex();
              res.json({ message: 'Request submitted ✅', request_id: rid });
              setImmediate(() => {
                try {
                  const { notifyAdminsNewRequest } = require('../services/assignmentRequestNotify');
                  notifyAdminsNewRequest(db, rid);
                } catch (ne) {
                  console.error('[assignment-requests] notify:', ne);
                }
              });
            });
          });
        },
      );
    });
  };

  const insertInvAndTypes = () => {
    finishRequestInsert((rid, cb) => {
      const insertTypes = (ePrev) => {
        if (ePrev) return cb(ePrev);
        if (!typeUniq.length) return cb(null);
        const flatT = typeUniq.map((t) => [rid, t]).flat();
        const phT = typeUniq.map(() => '(?, ?)').join(', ');
        db.query(
          `INSERT INTO assignment_request_asset_types (request_id, asset_type) VALUES ${phT}`,
          flatT,
          cb,
        );
      };
      if (!invUniq.length) return insertTypes(null);
      const flatI = invUniq.map((iid) => [rid, iid]).flat();
      const phI = invUniq.map(() => '(?, ?)').join(', ');
      db.query(
        `INSERT INTO assignment_request_inventories (request_id, inventory_id) VALUES ${phI}`,
        flatI,
        insertTypes,
      );
    });
  };

  if (assetUniq.length > 0) {
    const checkAssets = `SELECT id FROM assets WHERE id IN (${assetUniq.map(() => '?').join(',')})`;
    db.query(checkAssets, assetUniq, (err, rows) => {
      if (err) {
        if (isMissingTable(err)) {
          return res.status(503).json({ message: 'Run migration 007_workflow_authority_requests.sql' });
        }
        return res.status(500).json({ message: err.message });
      }
      if (!rows || rows.length !== assetUniq.length) {
        return res.status(400).json({ message: 'One or more asset ids are invalid' });
      }
      finishRequestInsert((rid, cb) => {
        const values = assetUniq.map((aid) => [rid, aid]);
        const flat = values.flat();
        const ph = assetUniq.map(() => '(?, ?)').join(', ');
        db.query(`INSERT INTO assignment_request_items (request_id, asset_id) VALUES ${ph}`, flat, cb);
      });
    });
    return;
  }

  if (invUniq.length > 0) {
    const ph = invUniq.map(() => '?').join(',');
    db.query(`SELECT id FROM inventories WHERE id IN (${ph})`, invUniq, (err, rows) => {
      if (err) {
        if (isMissingTable(err)) {
          return res.status(503).json({ message: 'Inventories table missing — run migrations' });
        }
        return res.status(500).json({ message: err.message });
      }
      if (!rows || rows.length !== invUniq.length) {
        return res.status(400).json({ message: 'One or more inventory ids are invalid' });
      }
      insertInvAndTypes();
    });
    return;
  }

  insertInvAndTypes();
  });
};

exports.listMine = (req, res) => {
  const authId = req.user?.id;
  if (!authId) return res.status(401).json({ message: 'Unauthorized' });
  const sql = `
    SELECT r.id, r.status, r.user_message, r.admin_note, r.created_at, r.processed_at
    FROM assignment_requests r
    WHERE r.auth_user_id = ?
    ORDER BY r.id DESC
  `;
  db.query(sql, [authId], (err, rows) => {
    if (err) {
      if (isMissingTable(err)) return res.json([]);
      return res.status(500).json({ message: err.message });
    }
    res.json(rows || []);
  });
};

/** GET /api/assignment-requests/admin — pending + recent */
exports.listAdmin = (req, res) => {
  const sql = `
    SELECT r.*, au.username, au.email, u.id AS employee_users_id
    FROM assignment_requests r
    LEFT JOIN auth_users au ON au.id = r.auth_user_id
    LEFT JOIN users u ON u.auth_user_id = r.auth_user_id
    ORDER BY (r.status = 'Pending') DESC, r.id DESC
    LIMIT 100
  `;
  db.query(sql, (err, rows) => {
    if (err) {
      if (isMissingTable(err)) return res.json([]);
      return res.status(500).json({ message: err.message });
    }
    const ids = (rows || []).map((x) => x.id);
    if (ids.length === 0) return res.json([]);
    const inList = ids.map(() => '?').join(',');
    db.query(
      `SELECT i.request_id, i.asset_id, a.asset_type, a.brand, a.model, a.serial_number
       FROM assignment_request_items i
       JOIN assets a ON a.id = i.asset_id
       WHERE i.request_id IN (${inList})`,
      ids,
      (e2, items) => {
        if (e2) return res.status(500).json({ message: e2.message });
        const byReq = {};
        (items || []).forEach((it) => {
          if (!byReq[it.request_id]) byReq[it.request_id] = [];
          byReq[it.request_id].push(it);
        });
        db.query(
          `SELECT i.request_id, i.inventory_id, inv.name AS inventory_name
           FROM assignment_request_inventories i
           LEFT JOIN inventories inv ON inv.id = i.inventory_id
           WHERE i.request_id IN (${inList})`,
          ids,
          (e3, invRows) => {
            if (e3 && !isMissingTable(e3)) {
              return res.status(500).json({ message: e3.message });
            }
            const invList = e3 && isMissingTable(e3) ? [] : invRows || [];
            const byInv = {};
            invList.forEach((it) => {
              if (!byInv[it.request_id]) byInv[it.request_id] = [];
              byInv[it.request_id].push(it);
            });
            db.query(
              `SELECT request_id, asset_type FROM assignment_request_asset_types WHERE request_id IN (${inList})`,
              ids,
              (e4, typeRows) => {
                if (e4 && !isMissingTable(e4)) {
                  return res.status(500).json({ message: e4.message });
                }
                const tlist = e4 && isMissingTable(e4) ? [] : typeRows || [];
                const byTypes = {};
                tlist.forEach((it) => {
                  if (!byTypes[it.request_id]) byTypes[it.request_id] = [];
                  byTypes[it.request_id].push(it);
                });
                res.json(
                  (rows || []).map((r) => ({
                    ...r,
                    items: byReq[r.id] || [],
                    inventories: byInv[r.id] || [],
                    asset_types: byTypes[r.id] || [],
                  })),
                );
              },
            );
          },
        );
      },
    );
  });
};

/**
 * POST /api/assignment-requests/admin/:id/fulfill
 * body: { users_id? } — optional. If omitted, uses the Users row where auth_user_id matches this request.
 * If provided, must be users.id for that employee (or the requester login id when it equals auth_user_id).
 */
exports.fulfill = (req, res) => {
  const requestId = Number(req.params.id);
  const rawUid = req.body?.users_id;
  const hasExplicitUsersId =
    rawUid !== undefined && rawUid !== null && String(rawUid).trim() !== '';
  const usersId = hasExplicitUsersId ? Number(rawUid) : NaN;

  if (!Number.isFinite(requestId)) {
    return res.status(400).json({ message: 'Invalid request id' });
  }
  if (hasExplicitUsersId && (!Number.isFinite(usersId) || usersId <= 0)) {
    return res.status(400).json({ message: 'users_id must be a positive number when provided' });
  }

  db.query('SELECT * FROM assignment_requests WHERE id = ?', [requestId], (err, reqs) => {
    if (err) return res.status(500).json({ message: err.message });
    if (!reqs?.length) return res.status(404).json({ message: 'Request not found' });
    const ar = reqs[0];
    if (ar.status !== 'Pending') {
      return res.status(400).json({ message: 'Request is not pending' });
    }

    const authId = Number(ar.auth_user_id);

    const lookupByRequesterLogin = (onRow) => {
      db.query(
        'SELECT id, auth_user_id FROM users WHERE auth_user_id = ? LIMIT 1',
        [authId],
        (eAuto, byAuth) => {
          if (eAuto) return res.status(500).json({ message: eAuto.message });
          if (!byAuth?.length) {
            return res.status(404).json({
              message:
                'No employee row linked to this login in the database. On Users, open their row, set Login user id to ' +
                String(authId) +
                ', then click Save on that row (typing alone does not save). After that, leave this field blank or enter their Users #.',
            });
          }
          onRow(byAuth[0]);
        },
      );
    };

    const runFulfillForUser = (u, employeeUserId) => {
      if (u.auth_user_id == null || Number(u.auth_user_id) !== authId) {
        return res.status(400).json({
          message:
            'That Users row is not linked to this requester’s login. In Users, set Login user id to the requester’s account id, then click Save on that row.',
          requester_auth_user_id: ar.auth_user_id,
          hint: `Open Users: find (or create) the employee for ${ar.email || 'this requester'}, set Login user id = ${authId}, click Save, then try again (or leave the field blank).`,
        });
      }

      resolveRequestAssetIds(db, requestId, (e3, assetIds) => {
        if (e3) {
          return res.status(400).json({ message: e3.message || String(e3) });
        }
        if (!assetIds || assetIds.length === 0) {
          return res.status(400).json({ message: 'No assets resolved for this request' });
        }

          const phA = assetIds.map(() => '?').join(',');
          db.query(`SELECT id, status FROM assets WHERE id IN (${phA})`, assetIds, (eA, astRows) => {
            if (eA) return res.status(500).json({ message: eA.message });
            if (!astRows || astRows.length !== assetIds.length) {
              return res.status(400).json({ message: 'Some assets no longer exist' });
            }
            const statusOk = astRows.every((row) => {
              const s = String(row.status || '').toLowerCase().trim();
              return s === '' || s === 'available';
            });
            if (!statusOk) {
              return res.status(400).json({
                message: 'Some assets are not available (already assigned or in repair)',
              });
            }
            db.query(
              `SELECT asset_id FROM assignments WHERE asset_id IN (${phA}) AND status = 'Active'`,
              assetIds,
              (eB, busy) => {
                if (eB) return res.status(500).json({ message: eB.message });
                if (busy?.length) {
                  return res.status(400).json({
                    message: 'One or more assets already have an active assignment',
                  });
                }

                const tryAssign = (idx, cb) => {
                  if (idx >= assetIds.length) return cb(null);
                  const asset_id = assetIds[idx];
                  db.query(
                    "SELECT * FROM assignments WHERE asset_id=? AND status='Active'",
                    [asset_id],
                    (e4, active) => {
                      if (e4) return cb(e4);
                      if (active?.length) {
                        return cb(new Error(`Asset ${asset_id} is already assigned`));
                      }
                      const sql = `
                  INSERT INTO assignments (user_id, asset_id, start_time, condition_before, status)
                  VALUES (?, ?, NOW(), 'Good', 'Active')
                `;
                      db.query(sql, [employeeUserId, asset_id], (e5) => {
                        if (e5) return cb(e5);
                        db.query("UPDATE assets SET status='Assigned' WHERE id=?", [asset_id], (e6) => {
                          if (e6) return cb(e6);
                          tryAssign(idx + 1, cb);
                        });
                      });
                    },
                  );
                };

                db.query('START TRANSACTION', (tErr) => {
                  if (tErr) return res.status(500).json({ message: tErr.message });
                  tryAssign(0, (eAssign) => {
                    if (eAssign) {
                      db.query('ROLLBACK', () => {});
                      return res.status(400).json({ message: eAssign.message || String(eAssign) });
                    }
                    db.query(
                      "UPDATE assignment_requests SET status='Fulfilled', processed_at=NOW() WHERE id=?",
                      [requestId],
                      (e7) => {
                        if (e7) {
                          db.query('ROLLBACK', () => {});
                          return res.status(500).json({ message: e7.message });
                        }
                        db.query('COMMIT', (e8) => {
                          if (e8) return res.status(500).json({ message: e8.message });
                          notifyRagDebouncedReindex();
                          res.json({ message: 'Assets assigned ✅' });
                        });
                      },
                    );
                  });
                });
              },
            );
        });
      });
    };

    if (!hasExplicitUsersId) {
      lookupByRequesterLogin((u) => runFulfillForUser(u, u.id));
      return;
    }

    db.query('SELECT id, auth_user_id FROM users WHERE id = ?', [usersId], (e2, urows) => {
      if (e2) return res.status(500).json({ message: e2.message });
      if (urows?.length) {
        const u = urows[0];
        runFulfillForUser(u, u.id);
        return;
      }
      // Often admins paste the requester "login id" (auth_users.id) instead of employees.users.id
      if (Number(usersId) === authId) {
        lookupByRequesterLogin((u) => runFulfillForUser(u, u.id));
        return;
      }
      return res.status(404).json({
        message: `No Users row with id ${usersId}. Open Users and use the row # in the first column for this employee, or leave the field blank once Login user id ${authId} is saved on their row.`,
      });
    });
  });
};

exports.reject = (req, res) => {
  const requestId = Number(req.params.id);
  const admin_note = req.body?.admin_note != null ? String(req.body.admin_note).trim().slice(0, 2000) : null;
  if (!Number.isFinite(requestId)) return res.status(400).json({ message: 'Invalid id' });
  db.query(
    "UPDATE assignment_requests SET status='Rejected', admin_note=?, processed_at=NOW() WHERE id=? AND status='Pending'",
    [admin_note, requestId],
    (err, r) => {
      if (err) return res.status(500).json({ message: err.message });
      if (!r.affectedRows) return res.status(404).json({ message: 'Pending request not found' });
      notifyRagDebouncedReindex();
      res.json({ message: 'Request rejected' });
    },
  );
};
