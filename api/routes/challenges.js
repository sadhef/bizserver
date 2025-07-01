const express = require('express');
const router = express.Router();
const challengeController = require('../controllers/challengeController');
const { protect, restrictToAdmin } = require('../middleware/auth');

// Protect all routes
router.use(protect);

// IMPORTANT: Specific routes MUST come before parameterized routes

// CTF User routes (approved users only)
router.get('/current', challengeController.getCurrentChallenge);
router.post('/submit-flag', challengeController.submitFlag);
router.post('/request-hint', challengeController.requestHint);

// Admin monitoring routes
router.get('/admin/live-progress', restrictToAdmin, challengeController.getLiveProgress);
router.get('/admin/all', restrictToAdmin, challengeController.getAdminChallenges);
router.get('/stats', challengeController.getChallengeStats);

// User routes (approved users only)
router.get('/', challengeController.getAllChallenges);

// Admin CRUD routes
router.post('/', restrictToAdmin, challengeController.createChallenge);

// Admin progress management routes
router.get('/progress/:userId', restrictToAdmin, challengeController.getUserProgress);
router.patch('/progress/:userId/time-limit', restrictToAdmin, challengeController.updateUserTimeLimit);
router.patch('/progress/:userId/reset', restrictToAdmin, challengeController.resetUserProgress);

// Parameterized routes MUST come last
router.get('/:id', challengeController.getChallenge);
router.patch('/:id', restrictToAdmin, challengeController.updateChallenge);
router.delete('/:id', restrictToAdmin, challengeController.deleteChallenge);

module.exports = router;