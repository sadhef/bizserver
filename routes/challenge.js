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

    console.log('Starting challenge for user:', { userId: user._id, username: user.username });

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
    user.currentLevel = 1; // Always start at level 1
    user.completedLevels = [];
    user.submissions = [];
    user.totalAttempts = 0;

    await user.save();

    console.log('Challenge started successfully:', { 
      userId: user._id, 
      startTime: now, 
      endTime: endTime, 
      timeLimit: config.totalTimeLimit 
    });

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

    console.log('Getting current challenge for user:', { 
      userId: user._id, 
      currentLevel: user.currentLevel, 
      isActive: user.isActive 
    });

    // Check if challenge is started
    if (!user.isActive || !user.challengeStartTime) {
      return res.status(400).json({ 
        error: 'Challenge not started',
        code: 'CHALLENGE_NOT_STARTED',
        hasStarted: false
      });
    }

    // Get the challenge for current level
    const challenge = await Challenge.findOne({ 
      level: user.currentLevel, 
      isActive: true 
    });

    console.log('Found challenge:', { 
      challengeExists: !!challenge, 
      level: challenge?.level, 
      title: challenge?.title 
    });

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

// Submit flag - COMPLETELY FIXED
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

      console.log('=== FLAG SUBMISSION START ===');
      console.log('User:', { id: user._id, username: user.username, currentLevel: user.currentLevel });
      console.log('Config:', { maxLevels: config.maxLevels });
      console.log('Submitted flag:', flag);

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

      // Get current challenge
      const challenge = await Challenge.findOne({ 
        level: user.currentLevel, 
        isActive: true 
      });

      if (!challenge) {
        return res.status(404).json({ 
          error: 'Challenge not found for current level',
          code: 'CHALLENGE_NOT_FOUND'
        });
      }

      console.log('Current challenge:', { level: challenge.level, title: challenge.title, correctFlag: challenge.flag });

      const isCorrect = challenge.validateFlag(flag);
      const timeRemaining = user.getTimeRemaining();

      console.log('Flag validation:', { isCorrect });

      // Record submission
      user.submissions.push({
        level: user.currentLevel,
        flag: flag.trim(),
        isCorrect: isCorrect,
        timestamp: new Date()
      });
      user.totalAttempts += 1;

      if (isCorrect) {
        console.log('=== CORRECT FLAG SUBMITTED ===');
        
        const currentLevel = user.currentLevel;
        
        // Add current level to completed levels if not already there
        if (!user.completedLevels.includes(currentLevel)) {
          user.completedLevels.push(currentLevel);
        }

        console.log('Level completed:', { 
          currentLevel, 
          completedLevels: user.completedLevels,
          maxLevels: config.maxLevels
        });

        // Check if user has completed ALL levels
        const totalCompletedLevels = user.completedLevels.length;
        
        if (totalCompletedLevels >= config.maxLevels) {
          // All levels completed
          user.isActive = false;
          await user.save();

          console.log('=== ALL CHALLENGES COMPLETED ===');

          return res.json({
            success: true,
            message: 'Congratulations! You have completed all challenges!',
            completed: true,
            completedLevels: user.completedLevels,
            totalAttempts: user.totalAttempts,
            timeRemaining,
            finalLevel: currentLevel,
            allChallengesComplete: true
          });
        }

        // Not all levels completed, check for next level
        const nextLevel = currentLevel + 1;
        
        // Check if next challenge exists
        const nextChallenge = await Challenge.findOne({ 
          level: nextLevel, 
          isActive: true 
        });

        console.log('Next level check:', { 
          nextLevel, 
          nextChallengeExists: !!nextChallenge,
          totalCompleted: totalCompletedLevels,
          maxLevels: config.maxLevels
        });

        if (nextChallenge && nextLevel <= config.maxLevels) {
          // Move to next level
          user.currentLevel = nextLevel;
          await user.save();

          console.log('=== MOVED TO NEXT LEVEL ===');
          console.log('New level:', user.currentLevel);

          return res.json({
            success: true,
            message: `Correct! Moving to Level ${nextLevel}`,
            currentLevel: nextLevel,
            completedLevels: user.completedLevels,
            timeRemaining,
            hasNextLevel: true,
            totalAttempts: user.totalAttempts,
            moveToNextLevel: true,
            levelProgression: true
          });
        } else {
          // No next challenge found but not all levels completed
          user.isActive = false;
          await user.save();

          console.log('=== NO MORE CHALLENGES AVAILABLE ===');

          return res.json({
            success: true,
            message: 'Congratulations! You have completed all available challenges!',
            completed: true,
            completedLevels: user.completedLevels,
            totalAttempts: user.totalAttempts,
            timeRemaining,
            finalLevel: currentLevel,
            allChallengesComplete: true
          });
        }
      } else {
        // Incorrect flag - stay on same level
        await user.save();

        console.log('=== INCORRECT FLAG ===');

        return res.json({
          success: false,
          message: 'Incorrect flag. Try again!',
          currentLevel: user.currentLevel,
          timeRemaining,
          totalAttempts: user.totalAttempts,
          stayOnLevel: true
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

    const challenge = await Challenge.findOne({ 
      level: user.currentLevel, 
      isActive: true 
    });

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
        isCorrect: sub.isCorrect
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

module.exports = router;