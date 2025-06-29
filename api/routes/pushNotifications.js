const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const pushNotificationController = require('../controllers/pushNotificationController');
const { protect, restrictToAdmin } = require('../middleware/auth');

// Validation middleware
const notificationValidation = [
  body('title').isLength({ min: 1, max: 100 }).trim().escape(),
  body('message').isLength({ min: 1, max: 500 }).trim().escape(),
  body('url').optional().isURL()
];

// Get VAPID public key (public route)
router.get('/vapid-public-key', pushNotificationController.getVapidPublicKey);

// Protect all routes below this middleware
router.use(protect);

// User routes (for subscription management)
router.post('/subscribe', pushNotificationController.subscribe);
router.delete('/unsubscribe', pushNotificationController.unsubscribe);
router.get('/subscription-status', pushNotificationController.getSubscriptionStatus);

// Admin only routes
router.use(restrictToAdmin);

router.post('/send-to-all', notificationValidation, pushNotificationController.sendToAll);
router.post('/send-to-cloud-users', notificationValidation, pushNotificationController.sendToCloudUsers);
router.post('/send-to-regular-users', notificationValidation, pushNotificationController.sendToRegularUsers);
router.get('/history', pushNotificationController.getNotificationHistory);

module.exports = router;