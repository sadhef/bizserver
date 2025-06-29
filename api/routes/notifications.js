// api/routes/notifications.js
const express = require('express');
const { protect, restrictToAdmin } = require('../middleware/auth');
const {
  saveToken,
  removeToken,
  sendNotification,
  testNotification,
  getNotificationStats
} = require('../controllers/notificationController');

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// Public notification routes (for authenticated users)
router.post('/token', saveToken);
router.delete('/token', removeToken);

// Admin-only notification routes
router.use(restrictToAdmin);

router.post('/send', sendNotification);
router.post('/test', testNotification);
router.get('/stats', getNotificationStats);

module.exports = router;