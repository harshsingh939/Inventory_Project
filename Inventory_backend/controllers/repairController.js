const db = require('../db');

/**
 * Insert a new repair — tries column sets from newest schema (reported_at) down to legacy (created_at / minimal).
 */
exports.addRepair = (req, res) => {
  const { asset_id, issue } = req.body;
  const addedByRaw = req.body.added_by;
  const addedBy =
    addedByRaw != null && addedByRaw !== '' && !Number.isNaN(Number(addedByRaw))
      ? Number(addedByRaw)
      : null;

  if (!asset_id || !issue) {
    return res.status(400).json({ message: 'Asset and issue are required' });
  }

  const attempts = [];

  if (addedBy != null) {
    attempts.push({
      sql: 'INSERT INTO repairs (asset_id, issue, status, reported_at, added_by) VALUES (?, ?, ?, NOW(), ?)',
      params: [asset_id, issue, 'Pending', addedBy]
    });
  }
  attempts.push({
    sql: 'INSERT INTO repairs (asset_id, issue, status, reported_at) VALUES (?, ?, ?, NOW())',
    params: [asset_id, issue, 'Pending']
  });
  attempts.push({
    sql: "INSERT INTO repairs (asset_id, issue, status, created_at) VALUES (?, ?, 'Pending', NOW())",
    params: [asset_id, issue]
  });
  attempts.push({
    sql: "INSERT INTO repairs (asset_id, issue, status) VALUES (?, ?, 'Pending')",
    params: [asset_id, issue]
  });

  const runAttempt = (i) => {
    if (i >= attempts.length) {
      return res.status(500).json({ message: 'Could not insert repair for this database schema' });
    }
    db.query(attempts[i].sql, attempts[i].params, (err, result) => {
      if (err && err.code === 'ER_BAD_FIELD_ERROR') {
        return runAttempt(i + 1);
      }
      if (err) {
        return res.status(500).json({ message: err.message });
      }
      db.query("UPDATE assets SET status='Under Repair' WHERE id=?", [asset_id]);
      res.json({ message: 'Repair Added ✅', id: result.insertId });
    });
  };
  runAttempt(0);
};

exports.getRepairs = (req, res) => {
  db.query('SELECT * FROM repairs ORDER BY id DESC', (err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(result);
  });
};

/**
 * Completed repairs with device info.
 * Schema: reported_at (your table) + optional repair_cost, repair_notes, fixed_at after migration 003.
 */
exports.getRepairCostLog = (req, res) => {
  const queries = [
    `SELECT r.id, r.asset_id, r.issue, r.repair_cost, r.repair_notes, r.reported_at, r.fixed_at,
            a.asset_type, a.brand, a.model
     FROM repairs r
     LEFT JOIN assets a ON a.id = r.asset_id
     WHERE r.status = 'Fixed'
     ORDER BY COALESCE(r.fixed_at, r.reported_at) DESC, r.id DESC`,
    `SELECT r.id, r.asset_id, r.issue, r.repair_cost, r.repair_notes, r.reported_at,
            NULL AS fixed_at, a.asset_type, a.brand, a.model
     FROM repairs r
     LEFT JOIN assets a ON a.id = r.asset_id
     WHERE r.status = 'Fixed'
     ORDER BY r.reported_at DESC, r.id DESC`,
    `SELECT r.id, r.asset_id, r.issue,
            NULL AS repair_cost, NULL AS repair_notes, r.reported_at,
            NULL AS fixed_at, a.asset_type, a.brand, a.model
     FROM repairs r
     LEFT JOIN assets a ON a.id = r.asset_id
     WHERE r.status = 'Fixed'
     ORDER BY r.reported_at DESC, r.id DESC`,
    `SELECT r.id, r.asset_id, r.issue,
            NULL AS repair_cost, NULL AS repair_notes, r.created_at AS reported_at,
            NULL AS fixed_at, a.asset_type, a.brand, a.model
     FROM repairs r
     LEFT JOIN assets a ON a.id = r.asset_id
     WHERE r.status = 'Fixed'
     ORDER BY r.created_at DESC, r.id DESC`
  ];

  const run = (i) => {
    if (i >= queries.length) {
      return res.json([]);
    }
    db.query(queries[i], (err, rows) => {
      if (err && err.code === 'ER_BAD_FIELD_ERROR') {
        return run(i + 1);
      }
      if (err) return res.status(500).json({ message: err.message });
      res.json(rows || []);
    });
  };
  run(0);
};

exports.updateRepairStatus = (req, res) => {
  const repair_id = req.params.id;
  const { status, repair_cost, repair_notes } = req.body;

  if (!status) {
    return res.status(400).json({ message: 'Status is required' });
  }

  const normalizeCost = () => {
    if (repair_cost === undefined || repair_cost === null || repair_cost === '') return null;
    const n = Number(repair_cost);
    return Number.isFinite(n) ? n : null;
  };

  const normalizeNotes = () => {
    if (repair_notes === undefined || repair_notes === null) return null;
    const s = String(repair_notes).trim();
    return s.length ? s : null;
  };

  db.query('SELECT asset_id FROM repairs WHERE id = ?', [repair_id], (err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    if (!result || result.length === 0) {
      return res.status(404).json({ message: 'Repair not found' });
    }

    const asset_id = result[0].asset_id;

    const finish = (err2) => {
      if (err2) return res.status(500).json({ message: err2.message });
      if (status === 'Fixed') {
        db.query("UPDATE assets SET status = 'Available' WHERE id = ?", [asset_id], (err3) => {
          if (err3) return res.status(500).json({ message: err3.message });
          db.query('SELECT * FROM repairs WHERE id = ? LIMIT 1', [repair_id], (e4, r4) => {
            if (e4 || !r4?.[0]) {
              return res.json({ message: 'Status Updated ✅' });
            }
            const row = r4[0];
            res.json({
              message: 'Status Updated ✅',
              fixed_at: row.fixed_at ?? null,
              repair_cost: row.repair_cost ?? null,
              repair_notes: row.repair_notes ?? null
            });
          });
        });
      } else {
        res.json({ message: 'Status Updated ✅' });
      }
    };

    const runUpdate = (sql, params) => {
      db.query(sql, params, (err2) => {
        if (err2 && err2.code === 'ER_BAD_FIELD_ERROR' && status === 'Fixed') {
          db.query('UPDATE repairs SET status = ? WHERE id = ?', [status, repair_id], finish);
        } else {
          finish(err2);
        }
      });
    };

    if (status === 'Fixed') {
      const c = normalizeCost();
      const n = normalizeNotes();
      const attempts = [
        [
          'UPDATE repairs SET status = ?, repair_cost = ?, repair_notes = ?, fixed_at = NOW() WHERE id = ?',
          [status, c, n, repair_id]
        ],
        [
          'UPDATE repairs SET status = ?, repair_cost = ?, repair_notes = ? WHERE id = ?',
          [status, c, n, repair_id]
        ],
        ['UPDATE repairs SET status = ? WHERE id = ?', [status, repair_id]]
      ];
      const runAttempt = (i) => {
        if (i >= attempts.length) {
          return res.status(500).json({ message: 'Could not update repair' });
        }
        db.query(attempts[i][0], attempts[i][1], (err2) => {
          if (err2 && err2.code === 'ER_BAD_FIELD_ERROR') runAttempt(i + 1);
          else finish(err2);
        });
      };
      runAttempt(0);
    } else {
      runUpdate('UPDATE repairs SET status = ? WHERE id = ?', [status, repair_id]);
    }
  });
};
