const express = require('express');
const router = express.Router();
const disposalController = require('../controllers/disposalController');
const authMiddleware = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');

router.get('/', authMiddleware, requireAdmin, disposalController.listDisposals);
router.post('/', authMiddleware, requireAdmin, disposalController.disposeFromAssignment);

module.exports = router;
