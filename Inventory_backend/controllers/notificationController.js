const db = require('../db');

function isMissingTable(err) {
  return (
    err &&
    (err.code === 'ER_NO_SUCH_TABLE' ||
      err.errno === 1146 ||
      String(err.message || '').includes("doesn't exist"))
  );
}

/**
 * GET /api/notifications — admin feed: recent repairs + pending assignment requests + new signups.
 */
exports.getAdminNotifications = (req, res) => {
  const role = String(req.user?.role || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (!req.user || role !== 'admin') {
    return res.status(403).json({ message: 'Admin only' });
  }

  const repairSql = `
    SELECT
      'repair' AS kind,
      r.id,
      r.status AS repair_status,
      CASE
        WHEN r.status = 'ReviewPending'
          THEN CONCAT('[Vendor review] ', COALESCE(r.issue, ''), IFNULL(CONCAT(' | ', r.repair_notes), ''))
        ELSE r.issue
      END AS issue,
      a.asset_type,
      a.brand,
      DATE_FORMAT(COALESCE(r.reported_at, r.created_at), '%Y-%m-%d %H:%i:%s') AS created_at
    FROM repairs r
    LEFT JOIN assets a ON a.id = r.asset_id
    WHERE r.status IN ('Pending', 'ReviewPending')
    ORDER BY r.id DESC
    LIMIT 20
  `;

  const repairFallback = `
    SELECT
      'repair' AS kind,
      r.id,
      r.status AS repair_status,
      CASE
        WHEN r.status = 'ReviewPending'
          THEN CONCAT('[Vendor review] ', COALESCE(r.issue, ''), IFNULL(CONCAT(' | ', r.repair_notes), ''))
        ELSE r.issue
      END AS issue,
      NULL AS asset_type,
      NULL AS brand,
      DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s') AS created_at
    FROM repairs r
    WHERE r.status IN ('Pending', 'ReviewPending')
    ORDER BY r.id DESC
    LIMIT 20
  `;

  const assignmentSql = `
    SELECT
      'assignment_request' AS kind,
      r.id,
      r.user_message AS issue,
      (SELECT GROUP_CONCAT(DISTINCT t.asset_type ORDER BY t.asset_type SEPARATOR ', ')
       FROM assignment_request_asset_types t WHERE t.request_id = r.id) AS asset_type,
      au.username AS brand,
      DATE_FORMAT(r.created_at, '%Y-%m-%d %H:%i:%s') AS created_at
    FROM assignment_requests r
    JOIN auth_users au ON au.id = r.auth_user_id
    WHERE r.status = 'Pending'
    ORDER BY r.id DESC
    LIMIT 20
  `;

  const signupSql = `
    SELECT
      'new_signup' AS kind,
      u.id,
      u.email AS issue,
      NULL AS asset_type,
      u.username AS brand,
      DATE_FORMAT(u.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
      NULL AS repair_status
    FROM auth_users u
    LEFT JOIN users dir ON dir.auth_user_id = u.id
    WHERE LOWER(TRIM(COALESCE(u.role, ''))) = 'user'
      AND dir.id IS NULL
    ORDER BY u.id DESC
    LIMIT 15
  `;

  const signupSqlFallback = `
    SELECT
      'new_signup' AS kind,
      u.id,
      u.email AS issue,
      NULL AS asset_type,
      u.username AS brand,
      NULL AS created_at,
      NULL AS repair_status
    FROM auth_users u
    LEFT JOIN users dir ON dir.auth_user_id = u.id
    WHERE LOWER(TRIM(COALESCE(u.role, ''))) = 'user'
      AND dir.id IS NULL
    ORDER BY u.id DESC
    LIMIT 15
  `;

  const runRepairs = (cb) => {
    db.query(repairSql, (err, rows) => {
      if (err && (err.code === 'ER_BAD_FIELD_ERROR' || err.errno === 1054)) {
        return db.query(repairFallback, (e2, rows2) => cb(e2, rows2 || []));
      }
      if (err) return cb(err, []);
      cb(null, rows || []);
    });
  };

  runRepairs((eR, repairRows) => {
    if (eR) {
      return res.status(500).json({ message: eR.message });
    }
    db.query(assignmentSql, (eA, assignRows) => {
      if (eA) {
        if (isMissingTable(eA)) {
          return runSignups(repairRows, [], res);
        }
        return res.status(500).json({ message: eA.message });
      }
      return runSignups(repairRows, assignRows || [], res);
    });
  });

  function runSignups(repairRows, assignRows, res) {
    db.query(signupSql, (eS, signupRows) => {
      const rows =
        eS && (eS.code === 'ER_BAD_FIELD_ERROR' || eS.errno === 1054)
          ? null
          : eS
            ? []
            : signupRows || [];

      const finish = (sRows) => {
        const merged = normalizeRows([...(repairRows || []), ...(assignRows || []), ...(sRows || [])]);
        merged.sort((a, b) => {
          const ta = new Date(a.created_at || 0).getTime();
          const tb = new Date(b.created_at || 0).getTime();
          if (tb !== ta) return tb - ta;
          const ida = Number(a.id) || 0;
          const idb = Number(b.id) || 0;
          return idb - ida;
        });
        res.json(merged.slice(0, 30));
      };

      if (rows === null) {
        return db.query(signupSqlFallback, (e2, s2) => {
          if (e2) return finish([]);
          finish(s2 || []);
        });
      }
      if (eS) return finish([]);
      finish(rows);
    });
  }
};

function normalizeRows(rows) {
  return (rows || []).map((r) => ({
    kind: r.kind === 'assignment_request' ? 'assignment_request' : r.kind === 'new_signup' ? 'new_signup' : 'repair',
    id: typeof r.id === 'number' ? r.id : Number(r.id) || r.id,
    issue: r.issue ?? null,
    asset_type: r.asset_type ?? null,
    brand: r.brand ?? null,
    created_at: r.created_at || null,
    repair_status: r.repair_status ?? null,
  }));
}
