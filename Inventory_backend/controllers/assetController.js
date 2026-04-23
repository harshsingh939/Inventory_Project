const db = require('../db');

exports.getAssets = (req, res) => {
  const raw = req.query.inventory_id;
  const wantFilter =
    raw !== undefined &&
    raw !== null &&
    String(raw).trim() !== '' &&
    String(raw).toLowerCase() !== 'all';

  const runAll = () => {
    db.query('SELECT * FROM assets', (err, result) => {
      if (err) return res.status(500).json({ message: err.message });
      res.json(result);
    });
  };

  if (!wantFilter) {
    return runAll();
  }

  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return runAll();
  }

  db.query('SELECT * FROM assets WHERE inventory_id = ?', [n], (err, result) => {
    if (err && err.code === 'ER_BAD_FIELD_ERROR' && String(err.message).includes('inventory_id')) {
      return runAll();
    }
    if (err) return res.status(500).json({ message: err.message });
    res.json(result || []);
  });
};

exports.addAsset = (req, res) => {
  const { asset_type, brand, model, serial_number, cpu, ram, storage, inventory_id } = req.body;

  if (!asset_type || !brand || !model) {
    return res.status(400).json({ message: 'Asset type, brand and model are required' });
  }

  let inv = null;
  if (inventory_id !== undefined && inventory_id !== null && inventory_id !== '') {
    const n = Number(inventory_id);
    if (Number.isFinite(n)) inv = n;
  }

  const sqlWithInv = `
    INSERT INTO assets (asset_type, brand, model, serial_number, cpu, ram, storage, inventory_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Available')
  `;
  const paramsWithInv = [asset_type, brand, model, serial_number, cpu, ram, storage, inv];

  const sqlLegacy = `
    INSERT INTO assets (asset_type, brand, model, serial_number, cpu, ram, storage, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'Available')
  `;
  const paramsLegacy = [asset_type, brand, model, serial_number, cpu, ram, storage];

  db.query(sqlWithInv, paramsWithInv, (err, result) => {
    if (err && err.code === 'ER_BAD_FIELD_ERROR' && String(err.message).includes('inventory_id')) {
      return db.query(sqlLegacy, paramsLegacy, (err2, result2) => {
        if (err2) return res.status(500).json({ message: err2.message });
        return res.json({ message: 'Asset Added ✅', id: result2.insertId });
      });
    }
    if (err && (err.errno === 1452 || err.code === 'ER_NO_REFERENCED_ROW_2')) {
      return res.status(400).json({
        message:
          'Invalid inventory: that list does not exist. Refresh the page, pick a valid inventory, or run DB migrations.',
      });
    }
    if (err) return res.status(500).json({ message: err.message });
    res.json({ message: 'Asset Added ✅', id: result.insertId });
  });
};

exports.getAvailableAssets = (req, res) => {
  // Not on an active assignment; allow NULL/blank/Available (case-insensitive). Exclude assigned & under repair.
  const sql = `
    SELECT a.* FROM assets a
    LEFT JOIN assignments x ON x.asset_id = a.id AND x.status = 'Active'
    WHERE x.id IS NULL
      AND COALESCE(LOWER(TRIM(a.status)), 'available') NOT IN ('assigned', 'under repair')
  `;
  db.query(sql, (err, result) => {
    if (err) {
      // Older DBs / missing assignments table: fall back to simple list
      return db.query(
        "SELECT * FROM assets WHERE status = 'Available' OR status IS NULL OR TRIM(IFNULL(status,'')) = ''",
        (err2, rows) => {
          if (err2) return res.status(500).json({ message: err.message || err2.message });
          return res.json(rows || []);
        },
      );
    }
    res.json(result || []);
  });
};