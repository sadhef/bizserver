const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect, restrictToAdmin } = require('../middleware/auth');

// Protect all routes
router.use(protect);

// User profile routes (for regular users)
router.patch('/profile', userController.updateProfile);

// Admin only routes
router.use(restrictToAdmin);

// User management routes
router.get('/', userController.getAllUsers);
router.get('/stats', userController.getUserStats);

// User approval routes
router.patch('/:id/approve', userController.approveUser);
router.patch('/:id/reject', userController.rejectUser);
router.patch('/:id/suspend', userController.suspendUser);
router.delete('/:id', userController.deleteUser);

// Get specific user
router.get('/:id', userController.getUser);

module.exports = router;