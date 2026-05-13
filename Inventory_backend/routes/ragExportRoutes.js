const express = require('express');
const { requireRagInternalKey } = require('../middleware/ragInternalKeyMiddleware');
const ragSnapshotController = require('../controllers/ragSnapshotController');

const router = express.Router();

router.get('/snapshot', requireRagInternalKey, ragSnapshotController.getSnapshot);
router.get('/summary', requireRagInternalKey, ragSnapshotController.getSummary);

module.exports = router;
