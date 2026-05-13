const db = require('../db');
const { notifyRagDebouncedReindex } = require('../services/ragIndexNotify');
const assetHistoryLog = require('../services/assetHistoryLog');
const { rowWithEffectiveStatus } = require('../services/assetEffectiveStatus');

function isMissingAssetHistoryTable(err) {
  if (!err) return false;
  if (err.code === 'ER_NO_SUCH_TABLE' || err.errno === 1146) return true;
  const msg = String(err.message || '');
  return msg.includes("doesn't exist") && msg.includes('asset_history');
}

exports.getAssets = (req, res) => {
  const raw = req.query.inventory_id;
  const wantFilter =
    raw !== undefined &&
    raw !== null &&
    String(raw).trim() !== '' &&
    String(raw).toLowerCase() !== 'all';

  const mapRows = (rows) => (rows || []).map((r) => rowWithEffectiveStatus(r));

  const activeAssignJoin = `
    LEFT JOIN (
      SELECT asset_id, MIN(id) AS active_assignment_join_id
      FROM assignments
      WHERE status = 'Active'
      GROUP BY asset_id
    ) x ON x.asset_id = a.id`;

  const runAll = () => {
    db.query(
      `SELECT a.*, x.active_assignment_join_id
       FROM assets a
       ${activeAssignJoin}
       WHERE LOWER(TRIM(COALESCE(a.status, ''))) <> 'disposed'`,
      (err, result) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(mapRows(result));
      },
    );
  };

  if (!wantFilter) {
    return runAll();
  }

  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return runAll();
  }

  db.query(
    `SELECT a.*, x.active_assignment_join_id
     FROM assets a
     ${activeAssignJoin}
     WHERE a.inventory_id = ?
       AND LOWER(TRIM(COALESCE(a.status, ''))) <> 'disposed'`,
    [n],
    (err, result) => {
    if (err && err.code === 'ER_BAD_FIELD_ERROR' && String(err.message).includes('inventory_id')) {
      return runAll();
    }
      if (err) return res.status(500).json({ message: err.message });
      res.json(mapRows(result));
    },
  );
};

exports.addAsset = (req, res) => {
  const { asset_type, brand, model, serial_number, cpu, ram, storage, inventory_id } = req.body;

  if (!asset_type || !brand || !model) {
    return res.status(400).json({ message: 'Asset type, brand and model are required' });
  }

  let inv = null;
  if (inventory_id !== undefined && inventory_id !== null && inventory_id !== '') {
    const n = Number(inventory_id);
    if (Number.isFinite(n)) inv = n;
  }

  const sqlWithInv = `
    INSERT INTO assets (asset_type, brand, model, serial_number, cpu, ram, storage, inventory_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Available')
  `;
  const paramsWithInv = [asset_type, brand, model, serial_number, cpu, ram, storage, inv];

  const sqlLegacy = `
    INSERT INTO assets (asset_type, brand, model, serial_number, cpu, ram, storage, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'Available')
  `;
  const paramsLegacy = [asset_type, brand, model, serial_number, cpu, ram, storage];

  db.query(sqlWithInv, paramsWithInv, (err, result) => {
    if (err && err.code === 'ER_BAD_FIELD_ERROR' && String(err.message).includes('inventory_id')) {
      return db.query(sqlLegacy, paramsLegacy, (err2, result2) => {
        if (err2) return res.status(500).json({ message: err2.message });
        notifyRagDebouncedReindex();
        return res.json({ message: 'Asset Added ✅', id: result2.insertId });
      });
    }
    if (err && (err.errno === 1452 || err.code === 'ER_NO_REFERENCED_ROW_2')) {
      return res.status(400).json({
        message:
          'Invalid inventory: that list does not exist. Refresh the page, pick a valid inventory, or run DB migrations.',
      });
    }
    if (err) return res.status(500).json({ message: err.message });
    notifyRagDebouncedReindex();
    res.json({ message: 'Asset Added ✅', id: result.insertId });
  });
};

exports.getAvailableAssets = (req, res) => {
  // Not on an active assignment; allow NULL/blank/Available (case-insensitive). Exclude assigned & under repair.
  const sql = `
    SELECT a.* FROM assets a
    LEFT JOIN assignments x ON x.asset_id = a.id AND x.status = 'Active'
    WHERE x.id IS NULL
      AND COALESCE(LOWER(TRIM(a.status)), 'available') NOT IN ('assigned', 'under repair', 'disposed')
  `;
  db.query(sql, (err, result) => {
    if (err) {
      // Older DBs / missing assignments table: fall back to simple list
      return db.query(
        `SELECT * FROM assets
         WHERE (status = 'Available' OR status IS NULL OR TRIM(IFNULL(status,'')) = '')
           AND LOWER(TRIM(COALESCE(status, ''))) <> 'disposed'`,
        (err2, rows) => {
          if (err2) return res.status(500).json({ message: err.message || err2.message });
          return res.json(rows || []);
        },
      );
    }
    res.json(result || []);
  });
};

/**
 * GET /api/assets/:id/history
 * Prefers rows from `asset_history` (migration 015) when present; otherwise legacy joins.
 */
exports.getAssetHistory = (req, res) => {
  const assetId = Number(req.params.id);
  if (!Number.isFinite(assetId) || assetId <= 0) {
    return res.status(400).json({ message: 'Invalid asset id' });
  }

  const respondFromAssetHistory = (histRows) => {
    db.query('SELECT * FROM assets WHERE id = ? LIMIT 1', [assetId], (eAsset, assetRows) => {
      if (eAsset) return res.status(500).json({ message: eAsset.message });
      const asset = assetRows && assetRows[0] ? assetRows[0] : null;
      const assignments = assetHistoryLog.mergeAssignmentsFromHistory(histRows);
      const repairs = assetHistoryLog.repairsFromHistory(histRows);
      const disposed = assetHistoryLog.latestDisposalFromHistory(histRows);
      const events = assetHistoryLog.eventsFromHistorySlices(assignments, repairs, disposed);
      res.json({
        asset_id: assetId,
        asset,
        disposed,
        assignments,
        repairs,
        events,
      });
    });
  };

  db.query(
    'SELECT * FROM asset_history WHERE asset_id = ? ORDER BY occurred_at ASC, id ASC',
    [assetId],
    (eH, histRows) => {
      if (eH && !isMissingAssetHistoryTable(eH)) {
        return res.status(500).json({ message: eH.message });
      }
      if (!eH && histRows && histRows.length > 0) {
        return respondFromAssetHistory(histRows);
      }
      return runLegacyAssetHistory(req, res, assetId);
    },
  );
};

function runLegacyAssetHistory(req, res, assetId) {
  const assignmentSql = `
    SELECT
      a.id AS assignment_id,
      a.user_id,
      a.asset_id,
      a.start_time,
      a.end_time,
      a.working_minutes,
      a.condition_before,
      a.condition_after,
      a.status,
      u.name AS user_name,
      u.employee_id,
      u.department,
      COALESCE(ast.asset_type, di.asset_type) AS asset_type,
      COALESCE(ast.brand, di.brand) AS brand,
      COALESCE(ast.model, di.model) AS model,
      COALESCE(ast.serial_number, di.serial_number) AS serial_number
    FROM assignments a
    JOIN users u ON a.user_id = u.id
    LEFT JOIN assets ast ON ast.id = a.asset_id
    LEFT JOIN disposed_items di ON di.assignment_id = a.id
    WHERE a.asset_id = ?
       OR a.id IN (
         SELECT assignment_id FROM disposed_items
         WHERE former_asset_id = ? AND assignment_id IS NOT NULL
       )
    ORDER BY a.start_time DESC
  `;

  const assignmentSqlLegacy = `
    SELECT
      a.id AS assignment_id,
      a.user_id,
      a.asset_id,
      a.start_time,
      a.end_time,
      a.working_minutes,
      a.condition_before,
      a.condition_after,
      a.status,
      u.name AS user_name,
      u.employee_id,
      u.department,
      ast.asset_type AS asset_type,
      ast.brand AS brand,
      ast.model AS model,
      ast.serial_number AS serial_number
    FROM assignments a
    JOIN users u ON a.user_id = u.id
    LEFT JOIN assets ast ON ast.id = a.asset_id
    WHERE a.asset_id = ?
    ORDER BY a.start_time DESC
  `;

  const buildEvents = (assignments, repairs, disposed) => {
    const events = [];
    for (const a of assignments || []) {
      if (a.start_time) {
        events.push({
          kind: 'checkout',
          at: a.start_time,
          assignment_id: a.assignment_id,
          user_id: a.user_id,
          user_name: a.user_name,
          employee_id: a.employee_id,
          department: a.department,
          condition_before: a.condition_before,
          asset_type: a.asset_type,
          brand: a.brand,
          model: a.model,
          serial_number: a.serial_number,
        });
      }
      if (a.end_time) {
        events.push({
          kind: 'assignment_end',
          at: a.end_time,
          assignment_id: a.assignment_id,
          status: a.status,
          condition_after: a.condition_after,
          working_minutes: a.working_minutes,
          user_name: a.user_name,
        });
      }
    }
    for (const r of repairs || []) {
      const at = r.occurred_at || r.reported_at || r.created_at || null;
      events.push({
        kind: 'repair',
        at,
        repair_id: r.id,
        issue: r.issue,
        status: r.status,
        fixed_at: r.fixed_at ?? null,
        cost: r.cost ?? null,
      });
    }
    if (disposed && disposed.disposed_at) {
      events.push({
        kind: 'disposal',
        at: disposed.disposed_at,
        disposed_item_id: disposed.id,
        former_asset_id: disposed.former_asset_id,
        assignment_id: disposed.assignment_id,
        user_name: disposed.user_name,
        employee_id: disposed.employee_id,
        condition_after: disposed.condition_after,
        notes: disposed.notes,
      });
    }
    events.sort((x, y) => {
      const tx = x.at ? new Date(x.at).getTime() : 0;
      const ty = y.at ? new Date(y.at).getTime() : 0;
      return ty - tx;
    });
    return events;
  };

  const runRepairs = (onRows) => {
    const attempts = [
      `
        SELECT r.id, r.asset_id, r.issue, r.status,
          COALESCE(r.reported_at, r.created_at) AS occurred_at,
          r.fixed_at, r.cost
        FROM repairs r
        WHERE r.asset_id = ?
        ORDER BY COALESCE(r.reported_at, r.created_at) DESC, r.id DESC
      `,
      `
        SELECT r.id, r.asset_id, r.issue, r.status,
          r.reported_at AS occurred_at,
          r.fixed_at, r.cost
        FROM repairs r
        WHERE r.asset_id = ?
        ORDER BY r.reported_at DESC, r.id DESC
      `,
      `
        SELECT r.id, r.asset_id, r.issue, r.status,
          r.created_at AS occurred_at,
          NULL AS fixed_at, NULL AS cost
        FROM repairs r
        WHERE r.asset_id = ?
        ORDER BY r.created_at DESC, r.id DESC
      `,
      `
        SELECT r.id, r.asset_id, r.issue, r.status,
          NULL AS occurred_at, NULL AS fixed_at, NULL AS cost
        FROM repairs r
        WHERE r.asset_id = ?
        ORDER BY r.id DESC
      `,
    ];
    const next = (i) => {
      if (i >= attempts.length) return onRows([]);
      db.query(attempts[i], [assetId], (err, rows) => {
        if (err && err.code === 'ER_BAD_FIELD_ERROR') return next(i + 1);
        if (err && (err.code === 'ER_NO_SUCH_TABLE' || err.errno === 1146)) return onRows([]);
        if (err) return res.status(500).json({ message: err.message });
        onRows(rows || []);
      });
    };
    next(0);
  };

  db.query('SELECT * FROM assets WHERE id = ? LIMIT 1', [assetId], (eAsset, assetRows) => {
    if (eAsset) return res.status(500).json({ message: eAsset.message });
    const asset = assetRows && assetRows[0] ? assetRows[0] : null;

    const loadAssignments = (cb) => {
      db.query(assignmentSql, [assetId, assetId], (eA, assignments) => {
        if (
          eA &&
          (eA.code === 'ER_NO_SUCH_TABLE' ||
            eA.errno === 1146 ||
            String(eA.message || '').includes("doesn't exist"))
        ) {
          return db.query(assignmentSqlLegacy, [assetId], (e2, rows2) => {
            if (e2) return res.status(500).json({ message: e2.message });
            cb(rows2 || []);
          });
        }
        if (eA) return res.status(500).json({ message: eA.message });
        cb(assignments || []);
      });
    };

    loadAssignments((assignments) => {
      runRepairs((repairs) => {
        db.query(
          `SELECT id, former_asset_id, inventory_id, inventory_name, asset_type, brand, model, serial_number,
                  assignment_id, user_name, employee_id, department, condition_after, notes, disposed_at
           FROM disposed_items WHERE former_asset_id = ? ORDER BY disposed_at DESC LIMIT 1`,
          [assetId],
          (eD, dispRows) => {
            if (eD && (eD.code === 'ER_NO_SUCH_TABLE' || eD.errno === 1146)) {
              const events = buildEvents(assignments, repairs, null);
              return res.json({
                asset_id: assetId,
                asset,
                disposed: null,
                assignments: assignments || [],
                repairs,
                events,
              });
            }
            if (eD) return res.status(500).json({ message: eD.message });
            const disposed = dispRows && dispRows[0] ? dispRows[0] : null;
            const events = buildEvents(assignments, repairs, disposed);
            res.json({
              asset_id: assetId,
              asset,
              disposed,
              assignments: assignments || [],
              repairs,
              events,
            });
          },
        );
      });
    });
  });
}