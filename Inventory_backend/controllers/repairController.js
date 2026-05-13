const fs = require('fs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { notifyRagDebouncedReindex } = require('../services/ragIndexNotify');

const JWT_SECRET = 'inventtrack_secret_key_2024';

function tryActor(req) {
  const h = req.headers && req.headers.authorization;
  if (!h || typeof h !== 'string' || !h.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(h.split(' ')[1], JWT_SECRET);
  } catch {
    return null;
  }
}

function actorFromReq(req) {
  return req.user || tryActor(req);
}

/** `users.id` for this login, or null if not linked / column missing */
function getLinkedUserId(authUserId, cb) {
  db.query('SELECT id FROM users WHERE auth_user_id = ? LIMIT 1', [authUserId], (err, rows) => {
    if (err && err.code === 'ER_BAD_FIELD_ERROR') return cb(null, null);
    if (err) return cb(err);
    cb(null, rows?.length ? Number(rows[0].id) : null);
  });
}

function userHasActiveAssignment(userId, assetId, cb) {
  db.query(
    "SELECT 1 FROM assignments WHERE asset_id = ? AND user_id = ? AND status = 'Active' LIMIT 1",
    [assetId, userId],
    (err, rows) => {
      if (err && (err.code === 'ER_NO_SUCH_TABLE' || err.errno === 1146)) return cb(null, false);
      if (err) return cb(err);
      cb(null, !!(rows && rows.length));
    },
  );
}

/**
 * Insert a new repair — tries column sets from newest schema (reported_at) down to legacy (created_at / minimal).
 * Admins may report for any asset; others only for assets on an Active assignment to their employee row.
 */
exports.addRepair = (req, res) => {
  const { asset_id, issue } = req.body;
  if (!asset_id || !issue) {
    return res.status(400).json({ message: 'Asset and issue are required' });
  }
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const role = String(req.user.role || '').toLowerCase();
  const authId = Number(req.user.id);

  const runInsert = (addedBy) => {
    const attempts = [];
    if (addedBy != null) {
      attempts.push({
        sql: 'INSERT INTO repairs (asset_id, issue, status, reported_at, added_by) VALUES (?, ?, ?, NOW(), ?)',
        params: [asset_id, issue, 'Pending', addedBy],
      });
    }
    attempts.push({
      sql: 'INSERT INTO repairs (asset_id, issue, status, reported_at) VALUES (?, ?, ?, NOW())',
      params: [asset_id, issue, 'Pending'],
    });
    attempts.push({
      sql: "INSERT INTO repairs (asset_id, issue, status, created_at) VALUES (?, ?, 'Pending', NOW())",
      params: [asset_id, issue],
    });
    attempts.push({
      sql: "INSERT INTO repairs (asset_id, issue, status) VALUES (?, ?, 'Pending')",
      params: [asset_id, issue],
    });

    const runAttempt = (i) => {
      if (i >= attempts.length) {
        return res.status(500).json({ message: 'Could not insert repair for this database schema' });
      }
      const att = attempts[i];
      db.query(att.sql, att.params, (err, result) => {
        if (err && err.code === 'ER_BAD_FIELD_ERROR') {
          return runAttempt(i + 1);
        }
        if (err) {
          return res.status(500).json({ message: err.message });
        }
        db.query("UPDATE assets SET status='Under Repair' WHERE id=?", [asset_id]);
        notifyRagDebouncedReindex();
        res.json({ message: 'Repair Added ✅', id: result.insertId });
      });
    };
    runAttempt(0);
  };

  if (role === 'admin') {
    return runInsert(null);
  }

  getLinkedUserId(authId, (err, userId) => {
    if (err) return res.status(500).json({ message: err.message });
    if (userId == null) {
      return res.status(403).json({
        message: 'Save your employee profile under Users before raising a repair request.',
      });
    }
    userHasActiveAssignment(userId, asset_id, (e2, ok) => {
      if (e2) return res.status(500).json({ message: e2.message });
      if (!ok) {
        return res.status(403).json({
          message: 'You can only report repairs for equipment currently assigned to you.',
        });
      }
      runInsert(userId);
    });
  });
};

exports.getRepairs = (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const role = String(req.user.role || '').toLowerCase();

  if (role === 'admin') {
    const sqlWithReporter = `
      SELECT r.*,
        COALESCE(ua.name, ub.name) AS reporter_name,
        COALESCE(ua.employee_id, ub.employee_id) AS reporter_employee_id
      FROM repairs r
      LEFT JOIN users ua ON ua.id = r.added_by
      LEFT JOIN assignments act ON act.asset_id = r.asset_id AND act.status = 'Active'
      LEFT JOIN users ub ON ub.id = act.user_id
      ORDER BY r.id DESC
    `;
    const sqlNoAddedBy = `
      SELECT r.*, ub.name AS reporter_name, ub.employee_id AS reporter_employee_id
      FROM repairs r
      LEFT JOIN assignments act ON act.asset_id = r.asset_id AND act.status = 'Active'
      LEFT JOIN users ub ON ub.id = act.user_id
      ORDER BY r.id DESC
    `;
    const runAdmin = (useRich) => {
      const q = useRich ? sqlWithReporter : sqlNoAddedBy;
      db.query(q, (err, result) => {
        if (err && err.code === 'ER_BAD_FIELD_ERROR' && useRich) {
          return runAdmin(false);
        }
        if (err) return res.status(500).json({ message: err.message });
        res.json(result || []);
      });
    };
    return runAdmin(true);
  }

  if (role === 'repair_authority') {
    return res.json([]);
  }

  const authId = Number(req.user.id);
  getLinkedUserId(authId, (err, userId) => {
    if (err) return res.status(500).json({ message: err.message });
    if (userId == null) {
      return res.json([]);
    }
    /**
     * Only "current" requests for this custody: repairs this employee raised (added_by),
     * or legacy rows with no added_by but reported/created on or after this active assignment started.
     * Hides full asset history from previous assignees on the same machine.
     */
    const userRepairQueries = [
      {
        sql: `
      SELECT r.* FROM repairs r
      INNER JOIN assignments asn
        ON asn.asset_id = r.asset_id AND asn.status = 'Active' AND asn.user_id = ?
      WHERE (r.added_by = ? OR (r.added_by IS NULL AND COALESCE(r.reported_at, r.created_at) >= asn.start_time))
      ORDER BY r.id DESC`,
        params: [userId, userId],
      },
      {
        sql: `
      SELECT r.* FROM repairs r
      INNER JOIN assignments asn
        ON asn.asset_id = r.asset_id AND asn.status = 'Active' AND asn.user_id = ?
      WHERE (r.added_by = ? OR (r.added_by IS NULL AND r.reported_at >= asn.start_time))
      ORDER BY r.id DESC`,
        params: [userId, userId],
      },
      {
        sql: `
      SELECT r.* FROM repairs r
      INNER JOIN assignments asn
        ON asn.asset_id = r.asset_id AND asn.status = 'Active' AND asn.user_id = ?
      WHERE (r.added_by = ? OR (r.added_by IS NULL AND r.created_at >= asn.start_time))
      ORDER BY r.id DESC`,
        params: [userId, userId],
      },
      {
        sql: `
      SELECT r.* FROM repairs r
      INNER JOIN assignments asn
        ON asn.asset_id = r.asset_id AND asn.status = 'Active' AND asn.user_id = ?
      WHERE r.added_by = ?
      ORDER BY r.id DESC`,
        params: [userId, userId],
      },
      {
        sql: `
      SELECT r.* FROM repairs r
      INNER JOIN assignments asn
        ON asn.asset_id = r.asset_id AND asn.status = 'Active' AND asn.user_id = ?
      WHERE COALESCE(r.reported_at, r.created_at) >= asn.start_time
      ORDER BY r.id DESC`,
        params: [userId],
      },
      {
        sql: `
      SELECT r.* FROM repairs r
      INNER JOIN assignments asn
        ON asn.asset_id = r.asset_id AND asn.status = 'Active' AND asn.user_id = ?
      WHERE r.reported_at >= asn.start_time
      ORDER BY r.id DESC`,
        params: [userId],
      },
      {
        sql: `
      SELECT r.* FROM repairs r
      INNER JOIN assignments asn
        ON asn.asset_id = r.asset_id AND asn.status = 'Active' AND asn.user_id = ?
      WHERE r.created_at >= asn.start_time
      ORDER BY r.id DESC`,
        params: [userId],
      },
    ];

    const runUserQ = (qi) => {
      if (qi >= userRepairQueries.length) {
        return res.json([]);
      }
      const { sql, params } = userRepairQueries[qi];
      db.query(sql, params, (e2, rows) => {
        if (e2) {
          if (e2.code === 'ER_NO_SUCH_TABLE' || e2.errno === 1146) {
            return res.json([]);
          }
          if (e2.code === 'ER_BAD_FIELD_ERROR') {
            return runUserQ(qi + 1);
          }
          return res.status(500).json({ message: e2.message });
        }
        res.json(rows || []);
      });
    };
    runUserQ(0);
  });
};

/**
 * Completed repairs with device info.
 * Schema: reported_at (your table) + optional repair_cost, repair_notes, fixed_at after migration 003.
 */
exports.getRepairCostLog = (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  const queries = [
    `SELECT r.id, r.asset_id, r.issue, r.repair_cost, r.repair_notes, r.repair_bill, r.reported_at, r.fixed_at,
            a.asset_type, a.brand, a.model
     FROM repairs r
     LEFT JOIN assets a ON a.id = r.asset_id
     WHERE r.status = 'Fixed'
     ORDER BY COALESCE(r.fixed_at, r.reported_at) DESC, r.id DESC`,
    `SELECT r.id, r.asset_id, r.issue, r.repair_cost, r.repair_notes, r.reported_at, r.repair_bill,
            NULL AS fixed_at, a.asset_type, a.brand, a.model
     FROM repairs r
     LEFT JOIN assets a ON a.id = r.asset_id
     WHERE r.status = 'Fixed'
     ORDER BY r.reported_at DESC, r.id DESC`,
    /* repair_bill column missing — still return real cost/notes/fixed_at */
    `SELECT r.id, r.asset_id, r.issue, r.repair_cost, r.repair_notes, r.reported_at, r.fixed_at,
            NULL AS repair_bill, a.asset_type, a.brand, a.model
     FROM repairs r
     LEFT JOIN assets a ON a.id = r.asset_id
     WHERE r.status = 'Fixed'
     ORDER BY COALESCE(r.fixed_at, r.reported_at) DESC, r.id DESC`,
    `SELECT r.id, r.asset_id, r.issue, r.repair_cost, r.repair_notes, r.reported_at,
            NULL AS fixed_at, NULL AS repair_bill, a.asset_type, a.brand, a.model
     FROM repairs r
     LEFT JOIN assets a ON a.id = r.asset_id
     WHERE r.status = 'Fixed'
     ORDER BY r.reported_at DESC, r.id DESC`,
    `SELECT r.id, r.asset_id, r.issue,
            NULL AS repair_cost, NULL AS repair_notes, NULL AS repair_bill, r.reported_at,
            NULL AS fixed_at, a.asset_type, a.brand, a.model
     FROM repairs r
     LEFT JOIN assets a ON a.id = r.asset_id
     WHERE r.status = 'Fixed'
     ORDER BY r.reported_at DESC, r.id DESC`,
    `SELECT r.id, r.asset_id, r.issue,
            NULL AS repair_cost, NULL AS repair_notes, NULL AS repair_bill, r.created_at AS reported_at,
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
      const out = (rows || []).map((row) => {
        const raw = row.repair_cost;
        let repair_cost = null;
        if (raw != null && raw !== '') {
          const num = Number(raw);
          repair_cost = Number.isFinite(num) ? num : null;
        }
        return { ...row, repair_cost };
      });
      res.json(out);
    });
  };
  run(0);
};

exports.updateRepairStatus = (req, res) => {
  const repair_id = req.params.id;
  const body = req.body != null && typeof req.body === 'object' ? req.body : {};
  const { status, repair_cost, repair_notes } = body;

  if (!status) {
    if (req.file && req.file.path) fs.unlink(req.file.path, () => {});
    return res.status(400).json({ message: 'Status is required' });
  }

  const relativeBill =
    req.file && req.file.filename ? `repair-bills/${req.file.filename}` : null;

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

  const unlinkUploadedBill = () => {
    if (req.file && req.file.path) fs.unlink(req.file.path, () => {});
  };

  db.query('SELECT * FROM repairs WHERE id = ? LIMIT 1', [repair_id], (err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    if (!result || result.length === 0) {
      unlinkUploadedBill();
      return res.status(404).json({ message: 'Repair not found' });
    }

    const repairRow = result[0];
    const asset_id = repairRow.asset_id;

    const proceedWithUpdate = () => {
    const finish = (err2) => {
      if (err2) {
        unlinkUploadedBill();
        return res.status(500).json({ message: err2.message });
      }
      if (status === 'Fixed') {
        db.query("UPDATE assets SET status = 'Available' WHERE id = ?", [asset_id], (err3) => {
          if (err3) {
            unlinkUploadedBill();
            return res.status(500).json({ message: err3.message });
          }
          db.query('SELECT * FROM repairs WHERE id = ? LIMIT 1', [repair_id], (e4, r4) => {
            if (e4 || !r4?.[0]) {
              notifyRagDebouncedReindex();
              return res.json({ message: 'Status Updated ✅' });
            }
            const row = r4[0];
            notifyRagDebouncedReindex();
            res.json({
              message: 'Status Updated ✅',
              fixed_at: row.fixed_at ?? null,
              repair_cost: row.repair_cost ?? null,
              repair_notes: row.repair_notes ?? null,
              repair_bill: row.repair_bill ?? null,
            });
          });
        });
      } else {
        notifyRagDebouncedReindex();
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

      /* Try richest UPDATE first; fall back if a column (e.g. repair_notes / fixed_at) is missing so cost is not dropped. */
      const attemptsNoBill = [
        {
          usesBillCol: false,
          sql: 'UPDATE repairs SET status = ?, repair_cost = ?, repair_notes = ?, fixed_at = NOW() WHERE id = ?',
          params: [status, c, n, repair_id],
        },
        {
          usesBillCol: false,
          sql: 'UPDATE repairs SET status = ?, repair_cost = ?, repair_notes = ? WHERE id = ?',
          params: [status, c, n, repair_id],
        },
        {
          usesBillCol: false,
          sql: 'UPDATE repairs SET status = ?, repair_cost = ?, fixed_at = NOW() WHERE id = ?',
          params: [status, c, repair_id],
        },
        {
          usesBillCol: false,
          sql: 'UPDATE repairs SET status = ?, repair_cost = ? WHERE id = ?',
          params: [status, c, repair_id],
        },
        { usesBillCol: false, sql: 'UPDATE repairs SET status = ? WHERE id = ?', params: [status, repair_id] },
      ];

      const attempts =
        relativeBill != null
          ? [
              {
                usesBillCol: true,
                sql: 'UPDATE repairs SET status = ?, repair_cost = ?, repair_notes = ?, fixed_at = NOW(), repair_bill = ? WHERE id = ?',
                params: [status, c, n, relativeBill, repair_id],
              },
              {
                usesBillCol: true,
                sql: 'UPDATE repairs SET status = ?, repair_cost = ?, repair_notes = ?, repair_bill = ? WHERE id = ?',
                params: [status, c, n, relativeBill, repair_id],
              },
              {
                usesBillCol: true,
                sql: 'UPDATE repairs SET status = ?, repair_cost = ?, fixed_at = NOW(), repair_bill = ? WHERE id = ?',
                params: [status, c, relativeBill, repair_id],
              },
              {
                usesBillCol: true,
                sql: 'UPDATE repairs SET status = ?, repair_cost = ?, repair_bill = ? WHERE id = ?',
                params: [status, c, relativeBill, repair_id],
              },
              ...attemptsNoBill,
            ]
          : attemptsNoBill;

      const runAttempt = (i) => {
        if (i >= attempts.length) {
          unlinkUploadedBill();
          return res.status(500).json({ message: 'Could not update repair' });
        }
        const att = attempts[i];
        db.query(att.sql, att.params, (err2) => {
          if (err2 && err2.code === 'ER_BAD_FIELD_ERROR') {
            return runAttempt(i + 1);
          }
          if (err2) {
            unlinkUploadedBill();
            return res.status(500).json({ message: err2.message });
          }
          if (req.file && !att.usesBillCol) {
            fs.unlink(req.file.path, () => {});
          }
          finish(null);
        });
      };
      runAttempt(0);
    } else {
      const notesElse = normalizeNotes();
      if (notesElse && status === 'CannotRepair') {
        runUpdate('UPDATE repairs SET status = ?, repair_notes = ? WHERE id = ?', [
          status,
          notesElse,
          repair_id,
        ]);
      } else {
        runUpdate('UPDATE repairs SET status = ? WHERE id = ?', [status, repair_id]);
      }
    }
    };

    const actor = actorFromReq(req);
    if (!actor) {
      unlinkUploadedBill();
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const role = String(actor.role || '').toLowerCase();
    if (role === 'repair_authority') {
      const aid = repairRow.assigned_authority_auth_user_id;
      if (aid == null || Number(aid) !== Number(actor.id)) {
        unlinkUploadedBill();
        return res.status(403).json({ message: 'This repair is not assigned to your authority account' });
      }
      return proceedWithUpdate();
    }
    if (role === 'admin') {
      return proceedWithUpdate();
    }
    if (repairRow.status === 'Under repair' || repairRow.status === 'WithAuthority') {
      unlinkUploadedBill();
      return res.status(403).json({
        message: 'This repair is under repair with the vendor; only admin can change it now.',
      });
    }
    const authId = Number(actor.id);
    getLinkedUserId(authId, (gErr, userId) => {
      if (gErr) {
        unlinkUploadedBill();
        return res.status(500).json({ message: gErr.message });
      }
      if (userId == null) {
        unlinkUploadedBill();
        return res.status(403).json({ message: 'Employee profile required' });
      }
      userHasActiveAssignment(userId, asset_id, (aErr, hasAsn) => {
        if (aErr) {
          unlinkUploadedBill();
          return res.status(500).json({ message: aErr.message });
        }
        const addedBy = repairRow.added_by != null ? Number(repairRow.added_by) : null;
        const byReporter = Number.isFinite(addedBy) && addedBy === userId;
        if (!hasAsn && !byReporter) {
          unlinkUploadedBill();
          return res.status(403).json({ message: 'You can only update repairs for your assigned equipment.' });
        }
        proceedWithUpdate();
      });
    });
  });
};

/** GET /api/repairs/authority-queue — repairs assigned to this authority login */
exports.getAuthorityQueue = (req, res) => {
  const uid = req.user?.id;
  if (!uid) return res.status(401).json({ message: 'Unauthorized' });
  const sql = `
    SELECT r.*, a.asset_type, a.brand, a.model, a.serial_number
    FROM repairs r
    JOIN assets a ON a.id = r.asset_id
    WHERE r.assigned_authority_auth_user_id = ?
      AND r.status IN ('Under repair', 'WithAuthority')
    ORDER BY r.id DESC
  `;
  db.query(sql, [uid], (err, rows) => {
    if (err) {
      if (err.code === 'ER_BAD_FIELD_ERROR') {
        return res.json([]);
      }
      return res.status(500).json({ message: err.message });
    }
    res.json(rows || []);
  });
};

/** POST /api/repairs/assign-to-authority — admin hands a repair to an authority account */
exports.assignRepairToAuthority = (req, res) => {
  const repair_id = Number(req.body?.repair_id);
  const authority_auth_user_id = Number(req.body?.authority_auth_user_id);
  if (
    !Number.isFinite(repair_id) ||
    repair_id <= 0 ||
    !Number.isFinite(authority_auth_user_id) ||
    authority_auth_user_id <= 0
  ) {
    return res.status(400).json({
      message:
        'repair_id and authority_auth_user_id must be set. Pick a repair authority from the list (do not leave the default empty option).',
    });
  }

  db.query(
    "SELECT id FROM auth_users WHERE id = ? AND LOWER(TRIM(role)) = 'repair_authority'",
    [authority_auth_user_id],
    (e1, authRows) => {
      if (e1) return res.status(500).json({ message: e1.message });
      if (!authRows?.length) {
        return res.status(400).json({
          message:
            'That login is not a repair_authority account. Create or pick a user whose role is repair_authority in auth_users.',
        });
      }

      const sql = `
        UPDATE repairs
        SET assigned_authority_auth_user_id = ?,
            authority_updated_at = NOW(),
            status = 'Under repair'
        WHERE id = ?
          AND status IN ('Pending', 'Under repair', 'WithAuthority')
      `;
      db.query(sql, [authority_auth_user_id, repair_id], (e2, r2) => {
        if (e2) {
          if (e2.code === 'ER_BAD_FIELD_ERROR') {
            return res.status(503).json({ message: 'Run migration 007 for repair authority columns' });
          }
          return res.status(500).json({ message: e2.message });
        }
        if (!r2.affectedRows) {
          return res.status(404).json({ message: 'Repair not found or not in assignable state' });
        }
        notifyRagDebouncedReindex();
        res.json({ message: 'Repair assigned to authority ✅' });
      });
    },
  );
};
