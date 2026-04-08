const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.get('/',     userController.getUsers);
router.post('/add', userController.addUser);

module.exports = router;