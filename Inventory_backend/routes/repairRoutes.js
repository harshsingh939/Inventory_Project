const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { requireAdmin, requireAuthority } = require('../middleware/roleMiddleware');
const repairController = require('../controllers/repairController');
const { optionalMultipartRepairBill } = require('../middleware/repairBillUpload');

router.post('/add', authMiddleware, repairController.addRepair);
router.get('/authority-queue', authMiddleware, requireAuthority, repairController.getAuthorityQueue);
router.post('/assign-to-authority', authMiddleware, requireAdmin, repairController.assignRepairToAuthority);
router.get('/cost-log', repairController.getRepairCostLog);
router.get('/', authMiddleware, repairController.getRepairs);
router.put('/update/:id', authMiddleware, optionalMultipartRepairBill, repairController.updateRepairStatus);

module.exports = router;