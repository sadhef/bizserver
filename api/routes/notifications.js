const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { protect, restrictToAdmin } = require('../middleware/auth');

router.use(protect);

router.post('/token', notificationController.saveToken);
router.delete('/token', notificationController.removeToken);

router.use(restrictToAdmin);

router.post('/send', notificationController.sendNotification);
router.post('/test', notificationController.testNotification);
router.get('/stats', notificationController.getNotificationStats);

module.exports = router;