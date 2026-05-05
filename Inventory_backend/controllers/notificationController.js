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
 * GET /api/notifications — admin feed: recent repairs + pending assignment requests.
 */
exports.getAdminNotifications = (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin only' });
  }

  const repairSql = `
    SELECT
      'repair' AS kind,
      r.id,
      r.issue,
      a.asset_type,
      a.brand,
      DATE_FORMAT(COALESCE(r.reported_at, r.created_at), '%Y-%m-%d %H:%i:%s') AS created_at
    FROM repairs r
    LEFT JOIN assets a ON a.id = r.asset_id
    ORDER BY r.id DESC
    LIMIT 20
  `;

  const repairFallback = `
    SELECT
      'repair' AS kind,
      r.id,
      r.issue,
      NULL AS asset_type,
      NULL AS brand,
      DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s') AS created_at
    FROM repairs r
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
          return res.json(normalizeRows(repairRows));
        }
        return res.status(500).json({ message: eA.message });
      }
      const merged = normalizeRows([...(repairRows || []), ...(assignRows || [])]);
      merged.sort((a, b) => {
        const ta = new Date(a.created_at || 0).getTime();
        const tb = new Date(b.created_at || 0).getTime();
        return tb - ta;
      });
      res.json(merged.slice(0, 25));
    });
  });
};

function normalizeRows(rows) {
  return (rows || []).map((r) => ({
    kind: r.kind || 'repair',
    id: typeof r.id === 'number' ? r.id : Number(r.id) || r.id,
    issue: r.issue ?? null,
    asset_type: r.asset_type ?? null,
    brand: r.brand ?? null,
    created_at: r.created_at || null,
  }));
}
