const db = require('../db');

exports.getAssets = (req, res) => {
  db.query("SELECT * FROM assets", (err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(result);
  });
};

exports.addAsset = (req, res) => {
  const { asset_type, brand, model, serial_number, cpu, ram, storage } = req.body;

  if (!asset_type || !brand || !model) {
    return res.status(400).json({ message: 'Asset type, brand and model are required' });
  }

  const sql = `
    INSERT INTO assets (asset_type, brand, model, serial_number, cpu, ram, storage)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(sql, [asset_type, brand, model, serial_number, cpu, ram, storage],
    (err, result) => {
      if (err) return res.status(500).json({ message: err.message });
      res.json({ message: 'Asset Added ✅', id: result.insertId });
    }
  );
};

exports.getAvailableAssets = (req, res) => {
  db.query("SELECT * FROM assets WHERE status='Available'", (err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(result);
  });
};