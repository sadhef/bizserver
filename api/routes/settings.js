const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { protect, restrictToAdmin } = require('../middleware/auth');

// Get settings
router.get('/', protect, settingsController.getSettings);

// Update settings (admin only)
router.post('/update', protect, restrictToAdmin, settingsController.updateSettings);

module.exports = router;