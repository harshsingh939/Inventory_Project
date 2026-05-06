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

/** Slots needed to fulfill a type/inventory-based request (same idea as resolveRequestAssetIds). */
function assignmentRequestRequiredSlotCount(dbConn, requestId, cb) {
  dbConn.query(
    `SELECT
      (SELECT COUNT(*) FROM assignment_request_asset_types WHERE request_id = ?) AS tc,
      (SELECT COUNT(*) FROM assignment_request_inventories WHERE request_id = ?) AS ic`,
    [requestId, requestId],
    (e, rows) => {
      if (e) {
        if (isMissingTable(e)) {
          return dbConn.query(
            'SELECT COUNT(*) AS c FROM assignment_request_items WHERE request_id = ?',
            [requestId],
            (e2, r2) => {
              if (e2) return cb(e2);
              return cb(null, Number(r2[0]?.c) || 0);
            },
          );
        }
        return cb(e);
      }
      const tc = Number(rows[0].tc) || 0;
      const ic = Number(rows[0].ic) || 0;
      const n = tc + ic;
      if (n > 0) return cb(null, n);
      dbConn.query(
        'SELECT COUNT(*) AS c FROM assignment_request_items WHERE request_id = ?',
        [requestId],
        (e3, r3) => {
          if (e3) return cb(e3);
          cb(null, Number(r3[0]?.c) || 0);
        },
      );
    },
  );
}

function appendAssignmentRequestItemAndMaybeFulfill(dbConn, requestId, assetId, cb) {
  assignmentRequestRequiredSlotCount(dbConn, requestId, (e1, required) => {
    if (e1) return cb(e1);
    if (!Number.isFinite(required) || required < 1) {
      return cb(
        new Error(
          'Could not determine how many assets this request needs. Complete the request from Assign requests instead.',
        ),
      );
    }
    const insSql = `
      INSERT INTO assignment_request_items (request_id, asset_id)
      SELECT ?, ? FROM DUAL
      WHERE NOT EXISTS (
        SELECT 1 FROM assignment_request_items WHERE request_id = ? AND asset_id = ?
      )`;
    dbConn.query(insSql, [requestId, assetId, requestId, assetId], (e2) => {
      if (e2) return cb(e2);
      dbConn.query(
        'SELECT COUNT(*) AS c FROM assignment_request_items WHERE request_id = ?',
        [requestId],
        (e3, cr) => {
          if (e3) return cb(e3);
          const cnt = Number(cr[0]?.c) || 0;
          if (cnt < required) return cb(null);
          dbConn.query(
            "UPDATE assignment_requests SET status = 'Fulfilled', processed_at = NOW() WHERE id = ? AND status = 'Pending'",
            [requestId],
            (e4) => {
              if (e4) return cb(e4);
              cb(null);
            },
          );
        },
      );
    });
  });
}

const SESSION_JOIN_SELECT = `
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
  WHERE a.id = ?
  LIMIT 1
`;

// ✅ Assign Asset to User
exports.startSession = (req, res) => {
  const { user_id, asset_id, condition_before, assignment_request_id } = req.body;

  if (!user_id || !asset_id) {
    return res.status(400).json({ message: 'User and Asset are required' });
  }

  const rawAr = assignment_request_id;
  const arId =
    rawAr !== undefined && rawAr !== null && String(rawAr).trim() !== ''
      ? Number(rawAr)
      : NaN;
  const hasAssignmentRequest = Number.isFinite(arId) && arId > 0;

  const runInsert = () => {
    db.query(
      "SELECT * FROM assignments WHERE asset_id=? AND status='Active'",
      [asset_id],
      (err, result) => {
        if (err) return res.status(500).json({ message: err.message });

        if (result.length > 0) {
          return res.status(400).json({ message: 'Asset is already assigned!' });
        }

        const sql = `
        INSERT INTO assignments (user_id, asset_id, start_time, condition_before, status)
        VALUES (?, ?, NOW(), ?, 'Active')
      `;

        db.query(sql, [user_id, asset_id, condition_before || 'Good'], (err2, insResult) => {
          if (err2) return res.status(500).json({ message: err2.message });

          const newId = insResult.insertId;

          db.query("UPDATE assets SET status='Assigned' WHERE id=?", [asset_id], (eUp) => {
            if (eUp) return res.status(500).json({ message: eUp.message });

            const respondOk = () => {
              db.query(SESSION_JOIN_SELECT, [newId], (e2, rows) => {
                if (e2) return res.status(500).json({ message: e2.message });
                const assignment = rows && rows[0] ? rows[0] : null;
                notifyRagDebouncedReindex();
                res.json({
                  message: 'Asset Assigned ✅',
                  assignment_id: newId,
                  assignment,
                });
              });
            };

            if (!hasAssignmentRequest) {
              return respondOk();
            }

            appendAssignmentRequestItemAndMaybeFulfill(db, arId, asset_id, (linkErr) => {
              if (linkErr) {
                return res.status(400).json({
                  message: linkErr.message || String(linkErr),
                });
              }
              return respondOk();
            });
          });
        });
      },
    );
  };

  if (!hasAssignmentRequest) {
    return runInsert();
  }

  db.query(
    'SELECT id, status, auth_user_id FROM assignment_requests WHERE id = ?',
    [arId],
    (e0, reqs) => {
      if (e0) return res.status(500).json({ message: e0.message });
      if (!reqs?.length) {
        return res.status(404).json({ message: 'Assignment request not found' });
      }
      const ar = reqs[0];
      if (String(ar.status) !== 'Pending') {
        return res.status(400).json({ message: 'This assignment request is no longer pending' });
      }
      db.query('SELECT id, auth_user_id FROM users WHERE id = ?', [user_id], (e1, urs) => {
        if (e1) return res.status(500).json({ message: e1.message });
        if (!urs?.length) {
          return res.status(400).json({ message: 'Invalid user' });
        }
        const ur = urs[0];
        if (ur.auth_user_id == null || Number(ur.auth_user_id) !== Number(ar.auth_user_id)) {
          return res.status(400).json({
            message:
              'Selected employee does not match this assignment request. In Assignments, pick the requester’s Users row (same login as on the ticket).',
          });
        }
        assignmentRequestRequiredSlotCount(db, arId, (ec, reqc) => {
          if (ec) return res.status(500).json({ message: ec.message });
          if (!Number.isFinite(reqc) || reqc < 1) {
            return res.status(400).json({
              message:
                'This request has no device types or inventories on file, so it cannot be completed from Assignments. Fix the ticket data or recreate the request.',
            });
          }
          runInsert();
        });
      });
    },
  );
};

// ✅ Unassign Asset
exports.endSession = (req, res) => {
  const { assignment_id, condition_after } = req.body;

  console.log('Unassign request:', assignment_id); // ✅ debug

  if (!assignment_id) {
    return res.status(400).json({ message: 'Assignment ID is required' });
  }

  // ✅ pehle asset_id lo
  db.query('SELECT asset_id FROM assignments WHERE id = ?', [assignment_id], (err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    if (!result || result.length === 0) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    const asset_id = result[0].asset_id;

    // ✅ assignment complete karo
    db.query(
      `UPDATE assignments SET 
        end_time = NOW(),
        working_minutes = TIMESTAMPDIFF(MINUTE, start_time, NOW()),
        condition_after = ?,
        status = 'Completed'
       WHERE id = ?`,
      [condition_after || 'Good', assignment_id],
      (err2) => {
        if (err2) return res.status(500).json({ message: err2.message });

        // ✅ asset available karo
        db.query(
          "UPDATE assets SET status = 'Available' WHERE id = ?",
          [asset_id],
          (err3) => {
            if (err3) return res.status(500).json({ message: err3.message });
            db.query(SESSION_JOIN_SELECT, [assignment_id], (e4, rows) => {
              if (e4) return res.status(500).json({ message: e4.message });
              const assignment = rows && rows[0] ? rows[0] : null;
              notifyRagDebouncedReindex();
              res.json({ message: 'Asset Unassigned ✅', assignment });
            });
          }
        );
      }
    );
  });
};

// ✅ Get all active assignments with user and asset details
exports.getActiveSessions = (req, res) => {
  const sql = `
    SELECT 
      a.id as assignment_id,
      a.start_time,
      a.condition_before,
      a.status,
      u.id as user_id,
      u.name as user_name,
      u.employee_id,
      u.department,
      ast.id as asset_id,
      ast.asset_type,
      ast.brand,
      ast.model,
      ast.serial_number
    FROM assignments a
    JOIN users u   ON a.user_id  = u.id
    JOIN assets ast ON a.asset_id = ast.id
    WHERE a.status = 'Active'
    ORDER BY a.start_time DESC
  `;
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(result);
  });
};

// ✅ Get all assignments history
exports.getAllAssignments = (req, res) => {
  const sql = `
    SELECT 
      a.id as assignment_id,
      a.user_id,
      a.asset_id,
      a.start_time,
      a.end_time,
      a.working_minutes,
      a.condition_before,
      a.condition_after,
      a.status,
      u.name as user_name,
      u.employee_id,
      u.department,
      COALESCE(ast.asset_type, di.asset_type) as asset_type,
      COALESCE(ast.brand, di.brand) as brand,
      COALESCE(ast.model, di.model) as model,
      COALESCE(ast.serial_number, di.serial_number) as serial_number
    FROM assignments a
    JOIN users u    ON a.user_id  = u.id
    LEFT JOIN assets ast ON ast.id = a.asset_id
    LEFT JOIN disposed_items di ON di.assignment_id = a.id
    ORDER BY a.start_time DESC
  `;
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(result);
  });
};