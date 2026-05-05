const db = require('../db');
const { notifyRagDebouncedReindex } = require('../services/ragIndexNotify');

exports.getUsers = (req, res) => {
  db.query("SELECT * FROM users", (err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(result);
  });
};

exports.addUser = (req, res) => {
  const { name, employee_id, department } = req.body;

  if (!name || !employee_id || !department) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  // ✅ duplicate employee_id check
  db.query('SELECT id FROM users WHERE employee_id = ?', [employee_id], (err, result) => {
    if (err) return res.status(500).json({ message: err.message });

    if (result.length > 0) {
      return res.status(400).json({ message: `Employee ID "${employee_id}" already exists!` });
    }

    // ✅ duplicate name check
    db.query('SELECT id FROM users WHERE name = ?', [name], (err2, result2) => {
      if (err2) return res.status(500).json({ message: err2.message });

      if (result2.length > 0) {
        return res.status(400).json({ message: `User "${name}" already exists!` });
      }

      db.query(
        'INSERT INTO users (name, employee_id, department) VALUES (?, ?, ?)',
        [name, employee_id, department],
        (err3, result3) => {
          if (err3) return res.status(500).json({ message: err3.message });
          notifyRagDebouncedReindex();
          res.json({ message: 'User Added ✅', id: result3.insertId });
        }
      );
    });
  });
};

/** PUT /api/users/:id — admin: link employee to login (auth_user_id), optional name/dept */
exports.updateUser = (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ message: 'Invalid user id' });
  }

  const { auth_user_id, name, employee_id, department } = req.body || {};
  const parts = [];
  const params = [];

  if (name !== undefined) {
    parts.push('name = ?');
    params.push(String(name).trim());
  }
  if (employee_id !== undefined) {
    parts.push('employee_id = ?');
    params.push(String(employee_id).trim());
  }
  if (department !== undefined) {
    parts.push('department = ?');
    params.push(String(department).trim());
  }
  if (auth_user_id !== undefined) {
    const v =
      auth_user_id === null || auth_user_id === '' ? null : Number(auth_user_id);
    if (v !== null && !Number.isFinite(v)) {
      return res.status(400).json({ message: 'auth_user_id must be a number or null' });
    }
    parts.push('auth_user_id = ?');
    params.push(v);
  }

  if (parts.length === 0) {
    return res.status(400).json({ message: 'No fields to update' });
  }

  params.push(id);
  const sql = `UPDATE users SET ${parts.join(', ')} WHERE id = ?`;

  const run = () => {
    db.query(sql, params, (err, result) => {
      if (err) {
        if (err.code === 'ER_BAD_FIELD_ERROR' && String(err.message).includes('auth_user_id')) {
          return res.status(503).json({ message: 'Run migration 007: users.auth_user_id column missing' });
        }
        if (err.errno === 1062 || err.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({ message: 'That login is already linked to another employee' });
        }
        return res.status(500).json({ message: err.message });
      }
      if (!result.affectedRows) {
        return res.status(404).json({ message: 'User not found' });
      }
      notifyRagDebouncedReindex();
      res.json({ message: 'User updated ✅' });
    });
  };

  const linkVal =
    auth_user_id !== undefined && auth_user_id !== null && auth_user_id !== ''
      ? Number(auth_user_id)
      : null;
  if (linkVal != null && Number.isFinite(linkVal)) {
    // Do not `return db.query(...)`: Express 5 treats the Query object as a Promise and breaks mysql2 callbacks.
    db.query('SELECT id FROM users WHERE auth_user_id = ? AND id <> ?', [linkVal, id], (e2, taken) => {
      if (e2) return res.status(500).json({ message: e2.message });
      if (taken?.length) {
        return res.status(400).json({ message: 'That login is already linked to another employee' });
      }
      run();
    });
    return;
  }

  run();
};