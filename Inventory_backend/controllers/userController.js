const db = require('../db');

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
          res.json({ message: 'User Added ✅', id: result3.insertId });
        }
      );
    });
  });
};