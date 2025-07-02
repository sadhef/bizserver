const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect, restrictToAdmin } = require('../middleware/auth');

// Protect all routes in this router - require authentication
router.use(protect);

// Restrict access to admin only
router.use(restrictToAdmin);

// Get all users (admin only)
router.get('/', userController.getAllUsers);

// Get user stats (admin only)
router.get('/stats', userController.getUserStats);

// Get, update or delete user by ID (admin only)
router.route('/:id')
  .get(userController.getUser)
  .patch(userController.updateUser)
  .delete(userController.deleteUser);

// Update user roles specifically (admin only)
router.patch('/:id/roles', userController.updateUserRoles);

// Create admin user (admin only)
router.post('/admin', userController.createAdminUser);

module.exports = router;