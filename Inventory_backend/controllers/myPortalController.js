const db = require('../db');

/** GET /api/me/assignments — active + recent completed for logged-in employee (users.auth_user_id) */
exports.getMyAssignments = (req, res) => {
  const authId = req.user?.id;
  if (!authId) return res.status(401).json({ message: 'Unauthorized' });

  db.query('SELECT id FROM users WHERE auth_user_id = ? LIMIT 1', [authId], (err, urows) => {
    if (err) {
      if (err.code === 'ER_BAD_FIELD_ERROR') {
        return res.json({ linked: false, user_id: null, active: [], history: [] });
      }
      return res.status(500).json({ message: err.message });
    }
    if (!urows?.length) {
      return res.json({
        linked: false,
        user_id: null,
        active: [],
        history: [],
        hint:
          'An administrator must add you under Team registration and set Login user id to your account id (from the signup notification email). Then open My profile or refresh this page.',
      });
    }
    const userId = urows[0].id;

    const activeSql = `
      SELECT a.id as assignment_id, a.start_time, a.condition_before, a.status,
             ast.id as asset_id, ast.asset_type, ast.brand, ast.model, ast.serial_number, ast.status as asset_status
      FROM assignments a
      JOIN assets ast ON ast.id = a.asset_id
      WHERE a.user_id = ? AND a.status = 'Active'
      ORDER BY a.start_time DESC
    `;
    db.query(activeSql, [userId], (e2, active) => {
      if (e2) return res.status(500).json({ message: e2.message });
      const histSql = `
        SELECT a.id as assignment_id, a.start_time, a.end_time, a.working_minutes, a.condition_after, a.status,
               ast.id as asset_id,
               COALESCE(ast.asset_type, di.asset_type) as asset_type,
               COALESCE(ast.brand, di.brand) as brand,
               COALESCE(ast.model, di.model) as model
        FROM assignments a
        LEFT JOIN assets ast ON ast.id = a.asset_id
        LEFT JOIN disposed_items di ON di.assignment_id = a.id
        WHERE a.user_id = ? AND a.status = 'Completed'
        ORDER BY a.end_time DESC
        LIMIT 30
      `;
      db.query(histSql, [userId], (e3, history) => {
        if (e3) return res.status(500).json({ message: e3.message });
        res.json({
          linked: true,
          user_id: userId,
          active: active || [],
          history: history || [],
        });
      });
    });
  });
};

/**
 * POST /api/me/employee — disabled: directory rows and login links are admin-only (Team registration).
 */
exports.registerMyEmployee = (req, res) => {
  res.status(403).json({
    message:
      'Employee profiles are created only by an administrator. Ask your admin to add you in Team registration and link your login.',
  });
};
