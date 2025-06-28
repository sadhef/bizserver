const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect, restrictToAdmin } = require('../middleware/auth');

// Admin dashboard stats
router.get('/stats', protect, restrictToAdmin, adminController.getAdminStats);

// User management
router.get('/users', protect, restrictToAdmin, adminController.getAllUsers);
router.get('/users/:id', protect, restrictToAdmin, adminController.getUser);
router.patch('/users/:id', protect, restrictToAdmin, adminController.updateUser);
router.delete('/users/:id', protect, restrictToAdmin, adminController.deleteUser);

// Challenge management
router.get('/challenges', protect, restrictToAdmin, adminController.getAllChallenges);
router.post('/challenges', protect, restrictToAdmin, adminController.createChallenge);
router.patch('/challenges/:id', protect, restrictToAdmin, adminController.updateChallenge);
router.delete('/challenges/:id', protect, restrictToAdmin, adminController.deleteChallenge);

// Progress management
router.get('/progress', protect, restrictToAdmin, adminController.getAllProgress);
router.patch('/progress/:userId', protect, restrictToAdmin, adminController.updateUserProgress);
router.delete('/progress/:userId', protect, restrictToAdmin, adminController.deleteUserProgress);

// System management
router.get('/system/info', protect, restrictToAdmin, adminController.getSystemInfo);
router.post('/system/backup', protect, restrictToAdmin, adminController.createBackup);
router.post('/system/reset', protect, restrictToAdmin, adminController.resetSystem);

// Analytics
router.get('/analytics/users', protect, restrictToAdmin, adminController.getUserAnalytics);
router.get('/analytics/challenges', protect, restrictToAdmin, adminController.getChallengeAnalytics);
router.get('/analytics/performance', protect, restrictToAdmin, adminController.getPerformanceAnalytics);

module.exports = router;