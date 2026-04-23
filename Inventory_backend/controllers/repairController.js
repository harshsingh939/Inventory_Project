const db = require('../db');

exports.addRepair = (req, res) => {
  const { asset_id, issue } = req.body;

  if (!asset_id || !issue) {
    return res.status(400).json({ message: 'Asset and issue are required' });
  }

  // Try with created_at first, fallback without if column doesn't exist
  db.query(
    "INSERT INTO repairs (asset_id, issue, status, created_at) VALUES (?, ?, 'Pending', NOW())",
    [asset_id, issue],
    (err, result) => {
      if (err) {
        // If created_at column doesn't exist, try without it
        if (err.code === 'ER_BAD_FIELD_ERROR' && err.message.includes('created_at')) {
          db.query(
            "INSERT INTO repairs (asset_id, issue, status) VALUES (?, ?, 'Pending')",
            [asset_id, issue],
            (err2, result2) => {
              if (err2) return res.status(500).json({ message: err2.message });
              db.query("UPDATE assets SET status='Under Repair' WHERE id=?", [asset_id]);
              res.json({ message: 'Repair Added ✅', id: result2.insertId });
            }
          );
        } else {
          return res.status(500).json({ message: err.message });
        }
      } else {
        db.query("UPDATE assets SET status='Under Repair' WHERE id=?", [asset_id]);
        res.json({ message: 'Repair Added ✅', id: result.insertId });
      }
    }
  );
};

exports.getRepairs = (req, res) => {
  db.query("SELECT * FROM repairs ORDER BY id DESC", (err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(result);
  });
};
exports.updateRepairStatus = (req, res) => {
  const repair_id = req.params.id;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ message: 'Status is required' });
  }

  // ✅ pehle asset_id lo
  db.query('SELECT asset_id FROM repairs WHERE id = ?', [repair_id], (err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    if (!result || result.length === 0) {
      return res.status(404).json({ message: 'Repair not found' });
    }

    const asset_id = result[0].asset_id;

    // ✅ status update karo
    db.query('UPDATE repairs SET status = ? WHERE id = ?', [status, repair_id], (err2) => {
      if (err2) return res.status(500).json({ message: err2.message });

      // ✅ agar fixed to asset available karo
      if (status === 'Fixed') {
        db.query("UPDATE assets SET status = 'Available' WHERE id = ?", [asset_id]);
      }

      res.json({ message: 'Status Updated ✅' });
    });
  });
};