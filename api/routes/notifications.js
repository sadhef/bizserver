const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { protect, restrictToCloud, restrictToAdmin } = require('../middleware/auth');

// Protect all routes
router.use(protect);

// Cloud user routes
router.post('/subscribe', restrictToCloud, notificationController.subscribe);
router.delete('/unsubscribe', restrictToCloud, notificationController.unsubscribe);
router.patch('/preferences', restrictToCloud, notificationController.updatePreferences);
router.get('/preferences', restrictToCloud, notificationController.getPreferences);
router.post('/test', restrictToCloud, notificationController.sendTestNotification);
router.get('/stats', restrictToCloud, notificationController.getNotificationStats);

// Admin routes for cron jobs
router.post('/process-due-tasks', restrictToAdmin, notificationController.processDueTasks);

module.exports = router;