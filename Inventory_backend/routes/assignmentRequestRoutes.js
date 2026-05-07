const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');
const assignmentRequestController = require('../controllers/assignmentRequestController');

router.post('/email-fulfill', assignmentRequestController.emailFulfill);
router.post('/', authMiddleware, assignmentRequestController.createRequest);
router.get('/mine', authMiddleware, assignmentRequestController.listMine);
router.get('/admin', authMiddleware, requireAdmin, assignmentRequestController.listAdmin);
router.post('/admin/:id/fulfill-manual', authMiddleware, requireAdmin, assignmentRequestController.fulfillManual);
router.post('/admin/:id/fulfill', authMiddleware, requireAdmin, assignmentRequestController.fulfill);
router.post('/admin/:id/reject', authMiddleware, requireAdmin, assignmentRequestController.reject);

module.exports = router;
