const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { protect, restrictToAdmin } = require('../middleware/auth');

// Protect all routes
router.use(protect);

// User routes - any authenticated user can save/remove their tokens
router.post('/token', notificationController.saveToken);
router.delete('/token', notificationController.removeToken);

// Admin-only routes
router.use(restrictToAdmin);

// Send notifications
router.post('/send', notificationController.sendNotification);

// Test notification
router.post('/test', notificationController.testNotification);

// Get notification statistics
router.get('/stats', notificationController.getNotificationStats);

// Clean up old tokens
router.post('/cleanup', notificationController.cleanupTokens);

module.exports = router;