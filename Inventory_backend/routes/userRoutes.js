const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');
const userController = require('../controllers/userController');

router.get('/', userController.getUsers);
router.post('/add', userController.addUser);
router.put('/:id', authMiddleware, requireAdmin, userController.updateUser);

module.exports = router;