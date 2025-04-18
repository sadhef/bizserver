const express = require('express');
const router = express.Router();
const progressController = require('../controllers/progressController');
const { protect, restrictToAdmin } = require('../middleware/auth');
const { validateMongoId } = require('../middleware/validate');

// Get my progress (user route)
router.get('/my-progress', protect, progressController.getMyProgress);

// Admin routes (protected + admin only)
router.get('/', protect, restrictToAdmin, progressController.getAllProgress);
router.get('/stats', protect, restrictToAdmin, progressController.getProgressStats);

// User progress management (admin only)
router.route('/:userId')
  .get(protect, restrictToAdmin, validateMongoId, progressController.getUserProgress)
  .patch(protect, restrictToAdmin, validateMongoId, progressController.updateUserProgress)
  .delete(protect, restrictToAdmin, validateMongoId, progressController.deleteUserProgress);

module.exports = router;