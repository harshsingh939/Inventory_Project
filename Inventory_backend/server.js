const express = require('express');
const cors = require('cors');
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
const repairRoutes  = require('./routes/repairRoutes');

app.use('/api/auth',     authRoutes);
app.use('/api/users',    userRoutes);
app.use('/api/assets',   assetRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/repairs',  repairRoutes);

app.get('/', (req, res) => res.send('Server Running ✅'));

app.listen(3000, () => console.log('Server running on port 3000 🚀'));