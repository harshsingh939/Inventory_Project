const express = require('express');
const cors = require('cors');
const db = require('./db');
const authMiddleware = require('./middleware/authMiddleware');
const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const authRoutes    = require('./routes/authRoutes');
const userRoutes    = require('./routes/userRoutes');
const assetRoutes   = require('./routes/assetRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const repairRoutes = require('./routes/repairRoutes');
const inventoryController = require('./controllers/inventoryController');

app.use('/api/auth',        authRoutes);
app.use('/api/users',       userRoutes);
app.use('/api/assets',      assetRoutes);
app.use('/api/sessions',    sessionRoutes);
app.use('/api/repairs',     repairRoutes);

// Inventories — register here so GET /api/inventories always resolves (avoids 404 if router file not loaded)
app.get('/api/inventories', (req, res) => inventoryController.listInventories(req, res));
app.get('/api/inventories/:id', (req, res) => inventoryController.getInventory(req, res));
app.post('/api/inventories', (req, res) => inventoryController.addInventory(req, res));
app.put('/api/inventories/:id', (req, res) => inventoryController.updateInventory(req, res));
app.delete('/api/inventories/:id', (req, res) => inventoryController.deleteInventory(req, res));

app.get('/', (req, res) => res.send('Server Running ✅'));
// Recent repairs for header notifications (admins only)
app.get('/api/notifications', authMiddleware, (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin only' });
  }
  const withJoin = `
    SELECT r.id, r.issue, a.asset_type, a.brand
    FROM repairs r
    LEFT JOIN assets a ON r.asset_id = a.id
    ORDER BY r.id DESC
    LIMIT 15
  `;
  const repairsOnly = `
    SELECT r.id, r.issue, NULL AS asset_type, NULL AS brand
    FROM repairs r
    ORDER BY r.id DESC
    LIMIT 15
  `;

  db.query(withJoin, (err, result) => {
    if (err) {
      if (err.code === 'ER_BAD_FIELD_ERROR' || err.errno === 1054) {
        return db.query(repairsOnly, (err2, rows) => {
          if (err2) return res.status(500).json({ message: err2.message });
          return res.json(rows || []);
        });
      }
      return res.status(500).json({ message: err.message });
    }
    res.json(result || []);
  });
});

app.listen(3000, () => console.log('Server running on port 3000 🚀'));