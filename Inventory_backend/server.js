const path = require('path');
require('./loadEnvFiles');

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
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads'), { index: false }));

const authRoutes    = require('./routes/authRoutes');
const userRoutes    = require('./routes/userRoutes');
const assetRoutes   = require('./routes/assetRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const repairRoutes = require('./routes/repairRoutes');
const disposalRoutes = require('./routes/disposalRoutes');
const assignmentRequestRoutes = require('./routes/assignmentRequestRoutes');
const myPortalRoutes = require('./routes/myPortalRoutes');
const ragProxyRoutes = require('./routes/ragProxyRoutes');
const ragExportRoutes = require('./routes/ragExportRoutes');
const inventoryController = require('./controllers/inventoryController');
const notificationController = require('./controllers/notificationController');

app.use('/api/auth',        authRoutes);
app.use('/api/users',       userRoutes);
app.use('/api/assets',      assetRoutes);
app.use('/api/sessions',    sessionRoutes);
app.use('/api/repairs',     repairRoutes);
app.use('/api/disposals',   disposalRoutes);
app.use('/api/assignment-requests', assignmentRequestRoutes);
app.use('/api/me', myPortalRoutes);
app.use('/api/rag', ragProxyRoutes);
app.use('/api/rag-export', ragExportRoutes);

// Inventories — register here so GET /api/inventories always resolves (avoids 404 if router file not loaded)
app.get('/api/inventories', (req, res) => inventoryController.listInventories(req, res));
app.get('/api/inventories/:id', (req, res) => inventoryController.getInventory(req, res));
app.post('/api/inventories', (req, res) => inventoryController.addInventory(req, res));
app.put('/api/inventories/:id', (req, res) => inventoryController.updateInventory(req, res));
app.delete('/api/inventories/:id', (req, res) => inventoryController.deleteInventory(req, res));

app.get('/', (req, res) => res.send('Server Running ✅'));
// Admin header feed: repairs + pending assignment requests
app.get('/api/notifications', authMiddleware, notificationController.getAdminNotifications);

app.listen(3000, () => console.log('Server running on port 3000 🚀'));