const express = require('express');
const router = express.Router();
const progressController = require('../controllers/progressController');
const { protect, restrictToAdmin } = require('../middleware/auth');

// Get all progress (admin only)
router.get('/', protect, restrictToAdmin, progressController.getAllProgress);

// Get current user's progress
router.get('/me', protect, progressController.getMyProgress);

// Get specific user's progress (admin only)
router.get('/:userId', protect, restrictToAdmin, progressController.getUserProgress);

// Update user progress (admin only)
router.patch('/:userId', protect, restrictToAdmin, progressController.updateUserProgress);

// Delete user progress (admin only)
router.delete('/:userId', protect, restrictToAdmin, progressController.deleteUserProgress);

// Get progress statistics (admin only)
router.get('/stats/overview', protect, restrictToAdmin, progressController.getProgressStats);

module.exports = router;