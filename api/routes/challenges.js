const express = require('express');
const router = express.Router();
const challengeController = require('../controllers/challengeController');
const { protect, restrictToAdmin, allowUserOrAdmin } = require('../middleware/auth');

// Get all challenges (admin only)
router.get('/', protect, restrictToAdmin, challengeController.getAllChallenges);

// Get current user's challenge
router.get('/current', protect, allowUserOrAdmin, challengeController.getCurrentChallenge);

// Create new challenge (admin only)
router.post('/', protect, restrictToAdmin, challengeController.createChallenge);

// Update challenge (admin only)
router.patch('/:id', protect, restrictToAdmin, challengeController.updateChallenge);

// Delete challenge (admin only)
router.delete('/:id', protect, restrictToAdmin, challengeController.deleteChallenge);

// Submit flag for current challenge
router.post('/submit', protect, allowUserOrAdmin, challengeController.submitFlag);

// Get hint for current challenge
router.get('/hint', protect, allowUserOrAdmin, challengeController.getHint);

module.exports = router;