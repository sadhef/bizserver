const express = require('express');
const router = express.Router();
const challengeController = require('../controllers/challengeController');
const { protect, restrictToAdmin } = require('../middleware/auth');
const { validateChallenge, validateFlagSubmission } = require('../middleware/validate');

// User routes (protected)
router.get('/current', protect, challengeController.getCurrentChallenge);
router.post('/submit-flag', protect, validateFlagSubmission, challengeController.submitFlag);
router.post('/request-hint', protect, challengeController.requestHint);

// Admin routes (protected + admin only)
router.route('/')
  .get(protect, restrictToAdmin, challengeController.getAllChallenges)
  .post(protect, restrictToAdmin, validateChallenge, challengeController.createChallenge);

router.get('/enabled', protect, restrictToAdmin, challengeController.getEnabledChallenges);

router.route('/:id')
  .get(protect, restrictToAdmin, challengeController.getChallenge)
  .patch(protect, restrictToAdmin, challengeController.updateChallenge)
  .delete(protect, restrictToAdmin, challengeController.deleteChallenge);

module.exports = router;