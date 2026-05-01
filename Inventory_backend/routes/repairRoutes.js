const express = require('express');
const router = express.Router();
const repairController = require('../controllers/repairController');

router.post('/add',        repairController.addRepair);
router.get('/cost-log',    repairController.getRepairCostLog);
router.get('/',            repairController.getRepairs);
router.put('/update/:id',  repairController.updateRepairStatus);

module.exports = router;