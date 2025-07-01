const express = require('express');
const router = express.Router();
const challengeController = require('../controllers/challengeController');
const { protect, restrictToAdmin } = require('../middleware/auth');

// Protect all routes
router.use(protect);

// User routes (approved users only)
router.get('/', challengeController.getAllChallenges);
router.get('/stats', challengeController.getChallengeStats);
router.get('/:id', challengeController.getChallenge);

// Admin routes
router.get('/admin/all', restrictToAdmin, challengeController.getAdminChallenges);
router.post('/', restrictToAdmin, challengeController.createChallenge);
router.patch('/:id', restrictToAdmin, challengeController.updateChallenge);
router.delete('/:id', restrictToAdmin, challengeController.deleteChallenge);

module.exports = router;