const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'inventtrack_secret_key_2024';

// SIGNUP
exports.signup = (req, res) => {
  const { username, email, mobile, password } = req.body;

  if (!username || !email || !mobile || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  // check email exists
  db.query('SELECT * FROM auth_users WHERE email = ?', [email], (err, result) => {
    if (err) return res.status(500).json({ message: 'DB error', error: err.message });

    if (result.length > 0) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // check mobile exists
    db.query('SELECT * FROM auth_users WHERE mobile = ?', [mobile], (err2, result2) => {
      if (err2) return res.status(500).json({ message: 'DB error', error: err2.message });

      if (result2.length > 0) {
        return res.status(400).json({ message: 'Mobile already registered' });
      }

      const hashedPassword = bcrypt.hashSync(password, 10);

      // ✅ role = 'user' by default
      const sql = `
        INSERT INTO auth_users (username, email, mobile, password, role)
        VALUES (?, ?, ?, ?, 'user')
      `;

      db.query(sql, [username, email, mobile, hashedPassword], (err3, result3) => {
        if (err3) {
          console.log('Signup DB error:', err3.message);
          return res.status(500).json({ message: 'Signup failed', error: err3.message });
        }
        res.status(201).json({ message: 'Account created successfully ✅' });
      });
    });
  });
};

// LOGIN
exports.login = (req, res) => {
  const { identifier, password } = req.body;

  const sql = `SELECT * FROM auth_users WHERE email = ? OR mobile = ?`;

  db.query(sql, [identifier, identifier], (err, result) => {
    if (err) return res.status(500).json({ message: 'DB error' });

    if (result.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }

    const user = result[0];

    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful ✅',
      token,
      user: {
        id:       user.id,
        username: user.username,
        email:    user.email,
        mobile:   user.mobile,
        role:     user.role    // ✅ role include
      }
    });
  });
};