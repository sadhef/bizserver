const express = require('express');
const User = require('../models/User');
const Challenge = require('../models/Challenge');
const Config = require('../models/Config');
const { 
  authenticateApprovedUser, 
  checkChallengeActive, 
  checkTimeLimit,
  rateLimitSubmissions 
} = require('../middleware/auth');

const router = express.Router();

// Start challenge
router.post('/start', authenticateApprovedUser, checkChallengeActive, async (req, res) => {
  try {
    const user = req.user;
    const config = req.config;

    // Check if user has already started
    if (user.challengeStartTime && user.isActive) {
      return res.json({
        message: 'Challenge already started',
        challengeStartTime: user.challengeStartTime,
        challengeEndTime: user.challengeEndTime,
        timeRemaining: user.getTimeRemaining()
      });
    }

    // Start new challenge
    const now = new Date();
    const endTime = new Date(now.getTime() + (config.totalTimeLimit * 60 * 1000));

    user.challengeStartTime = now;
    user.challengeEndTime = endTime;
    user.isActive = true;
    user.currentLevel = 1;
    user.completedLevels = [];
    user.submissions = [];
    user.totalAttempts = 0;

    await user.save();

    res.json({
      message: 'Challenge started successfully',
      challengeStartTime: now,
      challengeEndTime: endTime,
      timeLimit: config.totalTimeLimit,
      timeRemaining: config.totalTimeLimit * 60
    });
  } catch (error) {
    console.error('Start challenge error:', error);
    res.status(500).json({ 
      error: 'Server error starting challenge',
      code: 'START_CHALLENGE_ERROR'
    });
  }
});

// Get current challenge
router.get('/current', authenticateApprovedUser, checkTimeLimit, async (req, res) => {
  try {
    const user = req.user;

    if (!user.isActive || !user.challengeStartTime) {
      return res.status(400).json({ 
        error: 'Challenge not started',
        code: 'CHALLENGE_NOT_STARTED'
      });
    }

    const challenge = await Challenge.getActiveByLevel(user.currentLevel);

    if (!challenge) {
      return res.status(404).json({ 
        error: 'No challenge found for current level',
        code: 'CHALLENGE_NOT_FOUND'
      });
    }

    const timeRemaining = user.getTimeRemaining();

    res.json({
      challenge: challenge.getPublicData(),
      user: {
        currentLevel: user.currentLevel,
        completedLevels: user.completedLevels,
        totalAttempts: user.totalAttempts,
        challengeStartTime: user.challengeStartTime
      },
      timeRemaining,
      isActive: user.isActive
    });
  } catch (error) {
    console.error('Get current challenge error:', error);
    res.status(500).json({ 
      error: 'Server error fetching challenge',
      code: 'GET_CHALLENGE_ERROR'
    });
  }
});

// Submit flag
router.post('/submit', 
  authenticateApprovedUser, 
  checkChallengeActive, 
  checkTimeLimit, 
  rateLimitSubmissions,
  async (req, res) => {
    try {
      const { flag } = req.body;
      const user = req.user;
      const config = req.config;

      // Validation
      if (!flag || typeof flag !== 'string') {
        return res.status(400).json({ 
          error: 'Flag is required and must be a string',
          code: 'INVALID_FLAG'
        });
      }

      if (!user.isActive) {
        return res.status(403).json({ 
          error: 'Challenge not active',
          code: 'CHALLENGE_NOT_ACTIVE'
        });
      }

      // Check max attempts if configured
      if (config.maxAttempts !== -1 && user.totalAttempts >= config.maxAttempts) {
        return res.status(403).json({ 
          error: 'Maximum attempts reached',
          code: 'MAX_ATTEMPTS_REACHED'
        });
      }

      const challenge = await Challenge.getActiveByLevel(user.currentLevel);

      if (!challenge) {
        return res.status(404).json({ 
          error: 'Challenge not found',
          code: 'CHALLENGE_NOT_FOUND'
        });
      }

      // Check if user can access this level
      if (!user.canAccessLevel(user.currentLevel)) {
        return res.status(403).json({ 
          error: 'Must complete previous levels first',
          code: 'LEVEL_LOCKED'
        });
      }

      const isCorrect = challenge.validateFlag(flag);
      const timeRemaining = user.getTimeRemaining();

      // Record submission
      user.submissions.push({
        level: user.currentLevel,
        flag: flag.trim(),
        isCorrect: isCorrect,
        timestamp: new Date()
      });
      user.totalAttempts += 1;

      if (isCorrect) {
        // Correct flag submitted
        const currentLevel = user.currentLevel;
        
        // Add current level to completed levels
        if (!user.completedLevels.includes(currentLevel)) {
          user.completedLevels.push(currentLevel);
        }

        // Increment solve count for challenge
        await challenge.incrementSolveCount();

        // Check if there are more levels
        const nextLevel = currentLevel + 1;
        const nextChallenge = await Challenge.getActiveByLevel(nextLevel);

        if (nextChallenge && nextLevel <= config.maxLevels) {
          // Move to next level
          user.currentLevel = nextLevel;
          await user.save();

          res.json({
            success: true,
            message: `Correct! Moving to Level ${nextLevel}`,
            currentLevel: nextLevel,
            completedLevels: user.completedLevels,
            timeRemaining,
            hasNextLevel: true,
            totalAttempts: user.totalAttempts
          });
        } else {
          // Challenge completed
          user.isActive = false;
          await user.save();

          res.json({
            success: true,
            message: 'Congratulations! You have completed all challenges!',
            completed: true,
            completedLevels: user.completedLevels,
            totalAttempts: user.totalAttempts,
            timeRemaining,
            finalLevel: currentLevel
          });
        }
      } else {
        // Incorrect flag
        await user.save();

        res.json({
          success: false,
          message: 'Incorrect flag. Try again!',
          currentLevel: user.currentLevel,
          timeRemaining,
          totalAttempts: user.totalAttempts,
          remainingAttempts: config.maxAttempts === -1 ? -1 : (config.maxAttempts - user.totalAttempts)
        });
      }
    } catch (error) {
      console.error('Submit flag error:', error);
      res.status(500).json({ 
        error: 'Server error processing submission',
        code: 'SUBMIT_FLAG_ERROR'
      });
    }
  }
);

// Get challenge status
router.get('/status', authenticateApprovedUser, async (req, res) => {
  try {
    const user = req.user;
    const config = await Config.getConfig();
    
    const timeRemaining = user.getTimeRemaining();
    const isTimeExpired = user.isTimeExpired();

    // Auto-deactivate if time expired
    if (isTimeExpired && user.isActive) {
      user.isActive = false;
      await user.save();
    }

    res.json({
      isApproved: user.isApproved,
      isActive: user.isActive && !isTimeExpired,
      challengeActive: config.isChallengeTimeActive(),
      currentLevel: user.currentLevel,
      completedLevels: user.completedLevels,
      timeRemaining,
      hasStarted: !!user.challengeStartTime,
      totalAttempts: user.totalAttempts,
      maxAttempts: config.maxAttempts,
      challengeStartTime: user.challengeStartTime,
      challengeEndTime: user.challengeEndTime,
      isCompleted: user.completedLevels.length >= config.maxLevels
    });
  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({ 
      error: 'Server error fetching status',
      code: 'GET_STATUS_ERROR'
    });
  }
});

// Get hint for current level
router.get('/hint', authenticateApprovedUser, checkTimeLimit, async (req, res) => {
  try {
    const user = req.user;
    const config = await Config.getConfig();

    if (!config.allowHints) {
      return res.status(403).json({ 
        error: 'Hints are not allowed in this challenge',
        code: 'HINTS_DISABLED'
      });
    }

    if (!user.isActive) {
      return res.status(400).json({ 
        error: 'Challenge not active',
        code: 'CHALLENGE_NOT_ACTIVE'
      });
    }

    const challenge = await Challenge.getActiveByLevel(user.currentLevel);

    if (!challenge) {
      return res.status(404).json({ 
        error: 'Challenge not found',
        code: 'CHALLENGE_NOT_FOUND'
      });
    }

    res.json({
      hint: challenge.hint || 'No hint available for this level',
      level: challenge.level
    });
  } catch (error) {
    console.error('Get hint error:', error);
    res.status(500).json({ 
      error: 'Server error fetching hint',
      code: 'GET_HINT_ERROR'
    });
  }
});

// Get user's submission history
router.get('/submissions', authenticateApprovedUser, async (req, res) => {
  try {
    const user = req.user;
    const { level } = req.query;

    let submissions = user.submissions;

    // Filter by level if specified
    if (level) {
      submissions = submissions.filter(sub => sub.level === parseInt(level));
    }

    // Sort by timestamp (newest first)
    submissions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({
      submissions: submissions.map(sub => ({
        level: sub.level,
        timestamp: sub.timestamp,
        isCorrect: sub.isCorrect,
        // Don't include the actual flag for security
      })),
      totalAttempts: user.totalAttempts,
      currentLevel: user.currentLevel,
      completedLevels: user.completedLevels
    });
  } catch (error) {
    console.error('Get submissions error:', error);
    res.status(500).json({ 
      error: 'Server error fetching submissions',
      code: 'GET_SUBMISSIONS_ERROR'
    });
  }
});

// Reset user's challenge (for testing or if admin allows)
router.post('/reset', authenticateApprovedUser, async (req, res) => {
  try {
    const user = req.user;

    // Only allow reset if challenge is not active or user is not currently active
    if (user.isActive) {
      return res.status(400).json({ 
        error: 'Cannot reset while challenge is active',
        code: 'CHALLENGE_ACTIVE'
      });
    }

    // Reset user progress
    user.currentLevel = 1;
    user.completedLevels = [];
    user.submissions = [];
    user.totalAttempts = 0;
    user.challengeStartTime = null;
    user.challengeEndTime = null;
    user.isActive = false;

    await user.save();

    res.json({
      message: 'Challenge progress reset successfully',
      user: {
        currentLevel: user.currentLevel,
        completedLevels: user.completedLevels,
        totalAttempts: user.totalAttempts
      }
    });
  } catch (error) {
    console.error('Reset challenge error:', error);
    res.status(500).json({ 
      error: 'Server error resetting challenge',
      code: 'RESET_CHALLENGE_ERROR'
    });
  }
});

// Get leaderboard
router.get('/leaderboard', authenticateApprovedUser, async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const leaderboard = await User.aggregate([
      {
        $match: {
          isAdmin: false,
          isApproved: true,
          $expr: { $gt: [{ $size: '$completedLevels' }, 0] }
        }
      },
      {
        $addFields: {
          completedCount: { $size: '$completedLevels' },
          hasCompleted: { $gt: [{ $size: '$completedLevels' }, 0] }
        }
      },
      {
        $sort: {
          completedCount: -1,
          totalAttempts: 1, // Less attempts is better
          challengeEndTime: 1 // Earlier completion is better
        }
      },
      {
        $limit: parseInt(limit)
      },
      {
        $project: {
          username: 1,
          completedLevels: 1,
          completedCount: 1,
          totalAttempts: 1,
          challengeStartTime: 1,
          challengeEndTime: 1,
          isActive: 1
        }
      }
    ]);

    res.json({
      leaderboard,
      currentUser: {
        username: req.user.username,
        completedLevels: req.user.completedLevels,
        totalAttempts: req.user.totalAttempts,
        currentLevel: req.user.currentLevel
      }
    });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ 
      error: 'Server error fetching leaderboard',
      code: 'GET_LEADERBOARD_ERROR'
    });
  }
});

// Get challenge info (public info about the challenge)
router.get('/info', async (req, res) => {
  try {
    const config = await Config.getConfig();
    const totalChallenges = await Challenge.countDocuments({ isActive: true });

    res.json({
      challengeTitle: config.challengeTitle,
      challengeDescription: config.challengeDescription,
      totalLevels: Math.min(totalChallenges, config.maxLevels),
      timeLimit: config.totalTimeLimit,
      maxAttempts: config.maxAttempts,
      allowHints: config.allowHints,
      challengeActive: config.isChallengeTimeActive(),
      registrationOpen: config.registrationOpen,
      challengeStartDate: config.challengeStartDate,
      challengeEndDate: config.challengeEndDate
    });
  } catch (error) {
    console.error('Get challenge info error:', error);
    res.status(500).json({ 
      error: 'Server error fetching challenge info',
      code: 'GET_CHALLENGE_INFO_ERROR'
    });
  }
});

// Get all available levels (for navigation)
router.get('/levels', authenticateApprovedUser, async (req, res) => {
  try {
    const user = req.user;
    const config = await Config.getConfig();
    
    const challenges = await Challenge.find({ isActive: true })
      .sort({ level: 1 })
      .limit(config.maxLevels);

    const levels = challenges.map(challenge => ({
      level: challenge.level,
      title: challenge.title,
      difficulty: challenge.difficulty,
      category: challenge.category,
      points: challenge.points,
      isCompleted: user.completedLevels.includes(challenge.level),
      isAccessible: user.canAccessLevel(challenge.level),
      isCurrent: user.currentLevel === challenge.level
    }));

    res.json({
      levels,
      currentLevel: user.currentLevel,
      completedLevels: user.completedLevels
    });
  } catch (error) {
    console.error('Get levels error:', error);
    res.status(500).json({ 
      error: 'Server error fetching levels',
      code: 'GET_LEVELS_ERROR'
    });
  }
});

// Validate flag without submitting (for testing purposes - admin only)
router.post('/validate', authenticateApprovedUser, async (req, res) => {
  try {
    // This endpoint should only be available in development or for admins
    if (process.env.NODE_ENV === 'production' && !req.user.isAdmin) {
      return res.status(403).json({ 
        error: 'Validation endpoint not available in production',
        code: 'VALIDATION_DISABLED'
      });
    }

    const { flag, level } = req.body;

    if (!flag || !level) {
      return res.status(400).json({ 
        error: 'Flag and level are required',
        code: 'MISSING_PARAMETERS'
      });
    }

    const challenge = await Challenge.getActiveByLevel(parseInt(level));

    if (!challenge) {
      return res.status(404).json({ 
        error: 'Challenge not found',
        code: 'CHALLENGE_NOT_FOUND'
      });
    }

    const isValid = challenge.validateFlag(flag);

    res.json({
      valid: isValid,
      level: challenge.level,
      message: isValid ? 'Flag is correct' : 'Flag is incorrect'
    });
  } catch (error) {
    console.error('Validate flag error:', error);
    res.status(500).json({ 
      error: 'Server error validating flag',
      code: 'VALIDATE_FLAG_ERROR'
    });
  }
});

module.exports = router;