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
          'Open Users in the sidebar and submit the form under “Add yourself to the directory” (same fields). That links your login to the employee row so requests work here.',
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
 * POST /api/me/employee — logged-in user creates their own Users row (name, employee_id, department)
 * and links it to this account (auth_user_id). Required before assignment requests.
 */
exports.registerMyEmployee = (req, res) => {
  const authId = req.user?.id;
  if (!authId) return res.status(401).json({ message: 'Unauthorized' });

  const { name, employee_id, department } = req.body || {};
  if (!name || !employee_id || !department) {
    return res.status(400).json({ message: 'Name, Employee ID, and department are required' });
  }
  const nameT = String(name).trim();
  const empT = String(employee_id).trim();
  const deptT = String(department).trim();
  if (!nameT || !empT || !deptT) {
    return res.status(400).json({ message: 'Name, Employee ID, and department cannot be empty' });
  }

  db.query('SELECT id FROM users WHERE auth_user_id = ? LIMIT 1', [authId], (e0, already) => {
    if (e0) {
      if (e0.code === 'ER_BAD_FIELD_ERROR') {
        return res.status(503).json({ message: 'Run migration 007: users.auth_user_id column missing' });
      }
      return res.status(500).json({ message: e0.message });
    }
    if (already?.length) {
      return res.status(409).json({
        message: 'Your employee profile is already saved for this login.',
        user_id: already[0].id,
      });
    }

    db.query(
      'SELECT id, auth_user_id FROM users WHERE employee_id = ? LIMIT 1',
      [empT],
      (e1, byEmp) => {
        if (e1) return res.status(500).json({ message: e1.message });

        if (byEmp?.length) {
          const row = byEmp[0];
          const linkedOther =
            row.auth_user_id != null && Number(row.auth_user_id) !== Number(authId);
          if (linkedOther) {
            return res.status(400).json({
              message: 'This Employee ID is already linked to another account. Contact admin if this is wrong.',
            });
          }
          if (row.auth_user_id == null) {
            return db.query(
              'UPDATE users SET auth_user_id = ?, name = ?, department = ? WHERE id = ? AND auth_user_id IS NULL',
              [authId, nameT, deptT, row.id],
              (eu, ur) => {
                if (eu) {
                  if (eu.errno === 1062 || eu.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({
                      message: 'This login is already linked to another employee record.',
                    });
                  }
                  return res.status(500).json({ message: eu.message });
                }
                if (!ur.affectedRows) {
                  return res.status(409).json({ message: 'Could not link this Employee ID (it may have been updated).' });
                }
                return res.status(201).json({ message: 'Profile linked to your account.', user_id: row.id });
              }
            );
          }
        }

        db.query(
          'INSERT INTO users (name, employee_id, department, auth_user_id) VALUES (?, ?, ?, ?)',
          [nameT, empT, deptT, authId],
          (ei, ins) => {
            if (ei) {
              if (ei.code === 'ER_BAD_FIELD_ERROR' && String(ei.message).includes('auth_user_id')) {
                return res.status(503).json({ message: 'Run migration 007: users.auth_user_id column missing' });
              }
              if (ei.errno === 1062 || ei.code === 'ER_DUP_ENTRY') {
                if (String(ei.message).includes('employee_id')) {
                  return res.status(400).json({ message: 'This Employee ID is already in use.' });
                }
                return res.status(400).json({ message: 'This login is already linked to an employee profile.' });
              }
              return res.status(500).json({ message: ei.message });
            }
            return res.status(201).json({ message: 'Profile created.', user_id: ins.insertId });
          }
        );
      });
  });
};
