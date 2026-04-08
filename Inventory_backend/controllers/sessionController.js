const db = require('../db');

// ✅ Assign Asset to User
exports.startSession = (req, res) => {
  const { user_id, asset_id, condition_before } = req.body;

  if (!user_id || !asset_id) {
    return res.status(400).json({ message: 'User and Asset are required' });
  }

  // check asset already assigned
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

      db.query(sql, [user_id, asset_id, condition_before || 'Good'], (err, result) => {
        if (err) return res.status(500).json({ message: err.message });

        // update asset status
        db.query("UPDATE assets SET status='Assigned' WHERE id=?", [asset_id]);

        res.json({ message: 'Asset Assigned ✅', assignment_id: result.insertId });
      });
    }
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
            res.json({ message: 'Asset Unassigned ✅' });
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
      a.start_time,
      a.end_time,
      a.working_minutes,
      a.condition_before,
      a.condition_after,
      a.status,
      u.name as user_name,
      u.employee_id,
      ast.asset_type,
      ast.brand,
      ast.model
    FROM assignments a
    JOIN users u    ON a.user_id  = u.id
    JOIN assets ast ON a.asset_id = ast.id
    ORDER BY a.start_time DESC
  `;
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(result);
  });
};