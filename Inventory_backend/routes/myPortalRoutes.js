const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const myPortalController = require('../controllers/myPortalController');

router.get('/assignments', authMiddleware, myPortalController.getMyAssignments);
router.post('/employee', authMiddleware, myPortalController.registerMyEmployee);

module.exports = router;
