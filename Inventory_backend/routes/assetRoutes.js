const express = require('express');
const router = express.Router();
const assetController = require('../controllers/assetController');

router.get('/',          assetController.getAssets);
router.post('/add',      assetController.addAsset);
router.get('/available', assetController.getAvailableAssets);

module.exports = router;