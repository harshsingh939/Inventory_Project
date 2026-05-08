const db = require('../db');
const { writeHistory } = require('../services/historyWriter');

function isMissingTable(err) {
  return (
    err &&
    (err.code === 'ER_NO_SUCH_TABLE' ||
      err.errno === 1146 ||
      String(err.message || '').includes("doesn't exist"))
  );
}

function normalizeLimit(raw, fallback, max) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

function normalizePositiveInt(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

function resolveEmployeeRowByAuthUserId(authUserId, cb) {
  db.query(
    'SELECT id, name, employee_id FROM users WHERE auth_user_id = ? LIMIT 1',
    [authUserId],
    (err, rows) => {
      if (err) return cb(err);
      if (!rows || !rows.length) return cb(null, null);
      cb(null, rows[0]);
    },
  );
}

/**
 * POST /api/history
 * body: { asset_id, action, status, notes? }
 * Employee is derived from logged-in user (users.auth_user_id = req.user.id).
 */
exports.create = (req, res) => {
  const authId = req.user?.id;
  if (!authId) return res.status(401).json({ message: 'Unauthorized' });

  const asset_id = normalizePositiveInt(req.body?.asset_id);
  const action = req.body?.action != null ? String(req.body.action).trim().slice(0, 255) : '';
  const status = req.body?.status != null ? String(req.body.status).trim().slice(0, 100) : '';
  const notes = req.body?.notes != null ? String(req.body.notes).trim().slice(0, 1000) : null;

  if (!asset_id) return res.status(400).json({ message: 'asset_id is required' });
  if (!action) return res.status(400).json({ message: 'action is required' });

  resolveEmployeeRowByAuthUserId(authId, (eU, u) => {
    if (eU) return res.status(500).json({ message: eU.message });
    if (!u) {
      return res.status(403).json({
        message: 'Save your employee profile first under Users (and set Login user id), then try again.',
      });
    }

    writeHistory({
      asset_id,
      employee_id: u.id,
      employee_name: u.name || String(u.employee_id || u.id),
      action,
      status: status || null,
      notes,
    })
      .then(() => res.json({ message: 'History saved ✅' }))
      .catch(() => res.json({ message: 'History saved ✅' })); // best-effort
  });
};

/** GET /api/history/mine */
exports.listMine = (req, res) => {
  const authId = req.user?.id;
  if (!authId) return res.status(401).json({ message: 'Unauthorized' });

  const limit = normalizeLimit(req.query?.limit, 200, 500);
  const offset = Math.max(0, Number(req.query?.offset) || 0);
  const assetId = normalizePositiveInt(req.query?.asset_id);

  resolveEmployeeRowByAuthUserId(authId, (eU, u) => {
    if (eU) return res.status(500).json({ message: eU.message });
    if (!u) return res.json([]);

    const where = ['employee_id = ?'];
    const params = [u.id];
    if (assetId) {
      where.push('asset_id = ?');
      params.push(assetId);
    }

    const sql = `
      SELECT * FROM \`history\`
      WHERE ${where.join(' AND ')}
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `;
    params.push(limit, offset);

    db.query(sql, params, (err, rows) => {
      if (err) {
        if (isMissingTable(err)) return res.json([]);
        return res.status(500).json({ message: err.message });
      }
      return res.json(rows || []);
    });
  });
};

