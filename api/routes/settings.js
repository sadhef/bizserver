const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { protect, restrictToAdmin } = require('../middleware/auth');

// Public routes
router.get('/', settingsController.getSettings);

// Admin routes
router.use(protect);
router.use(restrictToAdmin);
router.patch('/', settingsController.updateSettings);

module.exports = router;