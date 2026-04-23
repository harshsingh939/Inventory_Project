const db = require('../db');

function isMissingTable(err) {
  return (
    err &&
    (err.code === 'ER_NO_SUCH_TABLE' ||
      err.errno === 1146 ||
      String(err.message || '').includes("doesn't exist"))
  );
}

/** List inventories — empty array if table not migrated yet */
exports.listInventories = (req, res) => {
  const sql = `SELECT * FROM inventories ORDER BY id DESC`;
  db.query(sql, (err, rows) => {
    if (err) {
      if (isMissingTable(err)) {
        return res.json([]);
      }
      return res.status(500).json({ message: err.message });
    }
    res.json(rows || []);
  });
};

exports.addInventory = (req, res) => {
  const { name, details } = req.body;
  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: 'Inventory name is required' });
  }
  const sql = `
    INSERT INTO inventories (name, details)
    VALUES (?, ?)
  `;
  db.query(sql, [String(name).trim(), details || null], (err, result) => {
    if (err) {
      if (isMissingTable(err)) {
        return res.status(400).json({
          message:
            'Database table `inventories` is missing. Run Inventory_backend/migrations/001_inventories.sql in MySQL, then retry.',
        });
      }
      return res.status(500).json({ message: err.message });
    }
    res.json({ message: 'Inventory created', id: result.insertId });
  });
};

exports.updateInventory = (req, res) => {
  const id = req.params.id;
  const { name, details } = req.body;
  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: 'Inventory name is required' });
  }
  const sql = `
    UPDATE inventories
    SET name = ?, details = ?
    WHERE id = ?
  `;
  db.query(sql, [String(name).trim(), details ?? null, id], (err, result) => {
    if (err) {
      if (isMissingTable(err)) {
        return res.status(400).json({ message: 'Table `inventories` missing. Run the migration SQL first.' });
      }
      return res.status(500).json({ message: err.message });
    }
    if (!result.affectedRows) return res.status(404).json({ message: 'Inventory not found' });
    res.json({ message: 'Inventory updated' });
  });
};

exports.deleteInventory = (req, res) => {
  const id = req.params.id;
  db.query('DELETE FROM inventories WHERE id = ?', [id], (err, result) => {
    if (err) {
      if (isMissingTable(err)) {
        return res.status(400).json({ message: 'Table `inventories` missing.' });
      }
      return res.status(500).json({ message: err.message });
    }
    if (!result.affectedRows) return res.status(404).json({ message: 'Inventory not found' });

    db.query('UPDATE assets SET inventory_id = NULL WHERE inventory_id = ?', [id], (err2) => {
      if (
        err2 &&
        (err2.code === 'ER_BAD_FIELD_ERROR' || String(err2.message || '').includes('inventory_id'))
      ) {
        // assets has no inventory_id column yet — inventory row still deleted
      } else if (err2) {
        return res.status(500).json({ message: err2.message });
      }
      res.json({ message: 'Inventory removed' });
    });
  });
};
