const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionController');

router.post('/start',  sessionController.startSession);
router.post('/end',    sessionController.endSession);
router.get('/active',  sessionController.getActiveSessions);
router.get('/all',     sessionController.getAllAssignments);

module.exports = router;