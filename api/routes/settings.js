const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { protect, restrictToAdmin } = require('../middleware/auth');

// Get system settings (admin only)
router.get('/', protect, restrictToAdmin, settingsController.getSettings);

// Update system settings (admin only)
router.post('/update', protect, restrictToAdmin, settingsController.updateSettings);

// Reset settings to default (admin only)
router.post('/reset', protect, restrictToAdmin, settingsController.resetSettings);

module.exports = router;