const db = require('../db');

function missingTable(err) {
  return (
    err &&
    (err.code === 'ER_NO_SUCH_TABLE' ||
      err.errno === 1146 ||
      String(err.message || '').includes("doesn't exist"))
  );
}

function skippableSchema(err) {
  return !!(err && (missingTable(err) || err.code === 'ER_BAD_FIELD_ERROR'));
}

function run(sql, cb) {
  db.query(sql, (err, rows) => {
    if (err && skippableSchema(err)) return cb(null, []);
    if (err) return cb(err);
    cb(null, rows || []);
  });
}

/**
 * GET /api/rag-export/snapshot — full DB snapshot for RAG indexing (no JWT; X-Internal-Key only).
 * Excludes password hashes. Large tables are capped to keep responses bounded.
 */
exports.getSnapshot = (req, res) => {
  const out = { generated_at: new Date().toISOString() };

  const steps = [
    ['inventories', 'SELECT * FROM inventories ORDER BY id DESC'],
    ['assets', 'SELECT * FROM assets ORDER BY id DESC LIMIT 8000'],
    ['users', 'SELECT * FROM users ORDER BY id DESC LIMIT 2000'],
    [
      'auth_users_public',
      'SELECT id, username, email, mobile, role FROM auth_users ORDER BY id DESC LIMIT 2000',
    ],
    ['assignments', 'SELECT * FROM assignments ORDER BY id DESC LIMIT 8000'],
    ['repairs', 'SELECT * FROM repairs ORDER BY id DESC LIMIT 3000'],
    [
      'disposed_items',
      `SELECT id, former_asset_id, inventory_id, inventory_name, asset_type, brand, model, serial_number,
              assignment_id, user_name, employee_id, department, condition_after, notes, disposed_at
       FROM disposed_items ORDER BY id DESC LIMIT 2000`,
    ],
    ['assignment_requests', 'SELECT * FROM assignment_requests ORDER BY id DESC LIMIT 1000'],
    ['assignment_request_items', 'SELECT * FROM assignment_request_items ORDER BY id DESC LIMIT 5000'],
    [
      'active_assignments',
      `SELECT a.id AS assignment_id, a.start_time, a.condition_before, a.status,
              u.id AS user_id, u.name AS user_name, u.employee_id, u.department,
              ast.id AS asset_id, ast.asset_type, ast.brand, ast.model, ast.serial_number
       FROM assignments a
       JOIN users u ON a.user_id = u.id
       JOIN assets ast ON a.asset_id = ast.id
       WHERE a.status = 'Active'
       ORDER BY a.start_time DESC
       LIMIT 500`,
    ],
    [
      'sessions',
      `SELECT a.id AS assignment_id,
              a.start_time, a.end_time, a.working_minutes,
              a.condition_before, a.condition_after, a.status,
              u.id AS user_id, u.name AS user_name, u.employee_id, u.department,
              ast.id AS asset_id,
              COALESCE(ast.asset_type, di.asset_type) AS asset_type,
              COALESCE(ast.brand, di.brand) AS brand,
              COALESCE(ast.model, di.model) AS model,
              COALESCE(ast.serial_number, di.serial_number) AS serial_number
       FROM assignments a
       JOIN users u ON a.user_id = u.id
       LEFT JOIN assets ast ON ast.id = a.asset_id
       LEFT JOIN disposed_items di ON di.assignment_id = a.id
       ORDER BY a.start_time DESC
       LIMIT 8000`,
    ],
  ];

  let i = 0;
  function next() {
    if (i >= steps.length) {
      return res.json(out);
    }
    const [key, sql] = steps[i];
    i += 1;
    run(sql, (err, rows) => {
      if (err) return res.status(500).json({ message: err.message });
      out[key] = rows;
      next();
    });
  }

  next();
};

/**
 * GET /api/rag-export/summary — tiny JSON: counts + timestamp for RAG chat grounding
 * (same auth as snapshot; no row payloads — safe to call each chat request).
 */
exports.getSummary = (req, res) => {
  const out = { generated_at: new Date().toISOString(), counts: {} };

  const steps = [
    ['inventories', 'SELECT COUNT(*) AS c FROM inventories'],
    ['assets', 'SELECT COUNT(*) AS c FROM assets'],
    ['users', 'SELECT COUNT(*) AS c FROM users'],
    ['auth_users', 'SELECT COUNT(*) AS c FROM auth_users'],
    ['assignments', 'SELECT COUNT(*) AS c FROM assignments'],
    [
      'active_assignments',
      `SELECT COUNT(*) AS c FROM assignments WHERE status = 'Active'`,
    ],
    ['repairs', 'SELECT COUNT(*) AS c FROM repairs'],
    ['disposed_items', 'SELECT COUNT(*) AS c FROM disposed_items'],
    ['assignment_requests', 'SELECT COUNT(*) AS c FROM assignment_requests'],
    ['assignment_request_items', 'SELECT COUNT(*) AS c FROM assignment_request_items'],
  ];

  let i = 0;
  function next() {
    if (i >= steps.length) {
      return res.json(out);
    }
    const [key, sql] = steps[i];
    i += 1;
    run(sql, (err, rows) => {
      if (err) return res.status(500).json({ message: err.message });
      const row = rows && rows[0];
      const c = row && row.c !== undefined ? Number(row.c) : 0;
      out.counts[key] = Number.isFinite(c) ? c : 0;
      next();
    });
  }

  next();
};
