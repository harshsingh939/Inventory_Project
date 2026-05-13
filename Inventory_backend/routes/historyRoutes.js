const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const historyController = require('../controllers/historyController');

router.post('/', authMiddleware, historyController.create);
router.get('/mine', authMiddleware, historyController.listMine);

module.exports = router;

