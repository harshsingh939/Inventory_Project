const db = require('../db');
const { notifyRagDebouncedReindex } = require('../services/ragIndexNotify');

function isMissingTable(err) {
  return (
    err &&
    (err.code === 'ER_NO_SUCH_TABLE' ||
      err.errno === 1146 ||
      String(err.message || '').includes("doesn't exist"))
  );
}

/** One-line label for UI / asset_names (matches app convention: "Type — brand model"). */
function formatAssetLabel(a) {
  const type = String(a.asset_type || '').trim();
  const brand = String(a.brand || '').trim();
  const model = String(a.model || '').trim();
  const core = [brand, model].filter(Boolean).join(' ').trim();
  if (type && core) return `${type} — ${core}`;
  if (core) return core;
  if (type) return type;
  return `Asset #${a.id}`;
}

/**
 * Attach live `assets` array plus `asset_count` / `asset_names` derived from `assets.inventory_id`.
 * If DB migration 011 added columns, response still uses live asset rows so API stays authoritative.
 */
function attachAssetsToInventories(inventoryRows, callback) {
  if (!inventoryRows || inventoryRows.length === 0) {
    return callback(null, inventoryRows);
  }
  const ids = [...new Set(inventoryRows.map((r) => Number(r.id)).filter((n) => Number.isFinite(n) && n > 0))];
  if (ids.length === 0) {
    return callback(null, inventoryRows);
  }
  const placeholders = ids.map(() => '?').join(',');
  const sql = `
    SELECT id, inventory_id, asset_type, brand, model, serial_number, status
    FROM assets
    WHERE inventory_id IN (${placeholders})
    ORDER BY inventory_id ASC, id ASC
  `;
  db.query(sql, ids, (err, assets) => {
    if (err) {
      if (err.code === 'ER_BAD_FIELD_ERROR' && String(err.message || '').includes('inventory_id')) {
        const fallback = inventoryRows.map((r) => ({
          ...r,
          asset_count: Number(r.asset_count) || 0,
          asset_names: r.asset_names != null ? String(r.asset_names) : '',
          assets: [],
        }));
        return callback(null, fallback);
      }
      return callback(err);
    }
    const byInv = {};
    ids.forEach((id) => {
      byInv[id] = [];
    });
    for (const a of assets || []) {
      const iid = a.inventory_id;
      if (iid == null || byInv[iid] === undefined) continue;
      const name = formatAssetLabel(a);
      byInv[iid].push({
        id: a.id,
        name,
        asset_type: a.asset_type,
        brand: a.brand,
        model: a.model,
        serial_number: a.serial_number,
        status: a.status,
      });
    }
    const out = inventoryRows.map((r) => {
      const list = byInv[r.id] || [];
      const asset_names = list.map((x) => x.name).join(', ');
      return {
        ...r,
        asset_count: list.length,
        asset_names,
        assets: list,
      };
    });
    return callback(null, out);
  });
}

/** List inventories — empty array if table not migrated yet */
exports.listInventories = (req, res) => {
  const sql = 'SELECT * FROM inventories ORDER BY id DESC';
  db.query(sql, (err, rows) => {
    if (err) {
      if (isMissingTable(err)) {
        return res.json([]);
      }
      return res.status(500).json({ message: err.message });
    }
    attachAssetsToInventories(rows || [], (e3, enriched) => {
      if (e3) return res.status(500).json({ message: e3.message });
      res.json(enriched);
    });
  });
};

exports.getInventory = (req, res) => {
  const id = req.params.id;
  db.query('SELECT * FROM inventories WHERE id = ?', [id], (err, rows) => {
    if (err) {
      if (isMissingTable(err)) {
        return res.status(400).json({ message: 'Table `inventories` missing.' });
      }
      return res.status(500).json({ message: err.message });
    }
    if (!rows || !rows.length) {
      return res.status(404).json({ message: 'Inventory not found' });
    }
    attachAssetsToInventories([rows[0]], (e3, enriched) => {
      if (e3) return res.status(500).json({ message: e3.message });
      res.json(enriched[0]);
    });
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
    notifyRagDebouncedReindex();
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
    notifyRagDebouncedReindex();
    res.json({ message: 'Inventory updated' });
  });
};

exports.deleteInventory = (req, res) => {
  const id = req.params.id;
  db.query('UPDATE assets SET inventory_id = NULL WHERE inventory_id = ?', [id], (err2) => {
    if (
      err2 &&
      (err2.code === 'ER_BAD_FIELD_ERROR' || String(err2.message || '').includes('inventory_id'))
    ) {
      // assets has no inventory_id column yet
    } else if (err2) {
      return res.status(500).json({ message: err2.message });
    }

    db.query('DELETE FROM inventories WHERE id = ?', [id], (err, result) => {
      if (err) {
        if (isMissingTable(err)) {
          return res.status(400).json({ message: 'Table `inventories` missing.' });
        }
        return res.status(500).json({ message: err.message });
      }
      if (!result.affectedRows) return res.status(404).json({ message: 'Inventory not found' });
      notifyRagDebouncedReindex();
      res.json({ message: 'Inventory removed' });
    });
  });
};
