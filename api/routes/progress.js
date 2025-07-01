const express = require('express');
const router = express.Router();
const progressController = require('../controllers/progressController');
const { protect } = require('../middleware/auth');

// Protect all routes
router.use(protect);

// Progress routes
router.get('/', progressController.getUserProgress);
router.get('/stats', progressController.getProgressStats);
router.post('/', progressController.createOrUpdateProgress);
router.patch('/:challengeId', progressController.updateProgress);

module.exports = router;