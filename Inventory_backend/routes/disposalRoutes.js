const express = require('express');
const router = express.Router();
const disposalController = require('../controllers/disposalController');

router.get('/', disposalController.listDisposals);
router.post('/', disposalController.disposeFromAssignment);

module.exports = router;
