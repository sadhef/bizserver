const Challenge = require('../models/Challenge');
const Progress = require('../models/Progress');
const Setting = require('../models/Setting');
const { AppError } = require('../../utils/errorHandler');

// Get current challenge for user
exports.getCurrentChallenge = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Get or create user progress
    const settings = await Setting.findOne() || { defaultTimeLimit: 3600 };
    let progress = await Progress.getOrCreateProgress(userId, settings);
    
    // Check if time has expired
    if (progress.isTimeExpired()) {
      await progress.save();
      return res.status(200).json({
        timeExpired: true,
        progress: {
          completed: progress.completed,
          timeExpired: true,
          finalScore: progress.finalScore,
          completedLevels: progress.completedLevels,
          totalTime: progress.totalTimeLimit
        }
      });
    }
    
    // Check if all challenges are completed
    const totalChallenges = await Challenge.countDocuments({ enabled: true });
    if (progress.completedLevels.length >= totalChallenges) {
      progress.completed = true;
      progress.completedAt = new Date();
      await progress.save();
      
      return res.status(200).json({
        completed: true,
        progress: {
          completed: true,
          completedLevels: progress.completedLevels,
          finalScore: progress.finalScore,
          completedAt: progress.completedAt
        }
      });
    }
    
    // Get current challenge
    const currentChallenge = await Challenge.findOne({
      levelNumber: progress.currentLevel,
      enabled: true
    });
    
    if (!currentChallenge) {
      throw new AppError('Current challenge not found', 404);
    }
    
    // Get attempt count for current level
    const levelAttempts = progress.levelAttempts.get(progress.currentLevel.toString());
    const attemptCount = levelAttempts ? levelAttempts.attempts : 0;
    
    // Check if hint was used
    const hintUsed = progress.isHintUsed(progress.currentLevel);
    
    // Calculate time remaining
    const now = new Date();
    const elapsed = Math.floor((now - progress.startTime) / 1000);
    const timeRemaining = Math.max(0, progress.totalTimeLimit - elapsed);
    
    progress.timeRemaining = timeRemaining;
    await progress.save();
    
    res.status(200).json({
      challenge: {
        _id: currentChallenge._id,
        levelNumber: currentChallenge.levelNumber,
        title: currentChallenge.title,
        description: currentChallenge.description,
        hint: hintUsed ? currentChallenge.hint : null,
        timeRemaining,
        totalTimeLimit: progress.totalTimeLimit,
        attemptCount,
        hintUsed,
        totalLevels: totalChallenges
      },
      progress: {
        currentLevel: progress.currentLevel,
        completedLevels: progress.completedLevels,
        totalTimeLimit: progress.totalTimeLimit,
        timeRemaining,
        completed: progress.completed,
        startTime: progress.startTime
      }
    });
  } catch (error) {
    next(error);
  }
};

// Submit flag for current challenge
exports.submitFlag = async (req, res, next) => {
  try {
    const { flag } = req.body;
    const userId = req.user.id;
    
    if (!flag || !flag.trim()) {
      throw new AppError('Flag is required', 400);
    }
    
    // Get user progress
    const progress = await Progress.findOne({ userId });
    if (!progress) {
      throw new AppError('Progress not found', 404);
    }
    
    // Check if time has expired
    if (progress.isTimeExpired()) {
      await progress.save();
      throw new AppError('Time has expired', 400);
    }
    
    // Get current challenge
    const currentChallenge = await Challenge.findOne({
      levelNumber: progress.currentLevel,
      enabled: true
    });
    
    if (!currentChallenge) {
      throw new AppError('Current challenge not found', 404);
    }
    
    // Add flag attempt
    progress.addFlagAttempt(progress.currentLevel, flag.trim());
    
    // Check if flag is correct
    const isCorrect = currentChallenge.flag.trim().toLowerCase() === flag.trim().toLowerCase();
    
    if (isCorrect) {
      // Complete current level
      progress.completeLevel(progress.currentLevel);
      
      // Calculate score (can be enhanced with time bonus, hint penalty, etc.)
      const basePoints = currentChallenge.points || 100;
      const hintPenalty = progress.isHintUsed(currentChallenge.levelNumber) ? 20 : 0;
      const levelScore = Math.max(basePoints - hintPenalty, 10);
      progress.finalScore += levelScore;
      
      // Check if all challenges are completed
      const totalChallenges = await Challenge.countDocuments({ enabled: true });
      const allCompleted = progress.completedLevels.length >= totalChallenges;
      
      if (allCompleted) {
        progress.completed = true;
        progress.completedAt = new Date();
      }
      
      await progress.save();
      
      res.status(200).json({
        correct: true,
        completed: allCompleted,
        message: allCompleted ? 'Congratulations! All challenges completed!' : 'Correct! Moving to next level.',
        levelScore,
        totalScore: progress.finalScore,
        nextLevel: allCompleted ? null : progress.currentLevel
      });
    } else {
      await progress.save();
      
      res.status(200).json({
        correct: false,
        message: 'Incorrect flag. Try again!',
        attempts: progress.levelAttempts.get(progress.currentLevel.toString())?.attempts || 0
      });
    }
  } catch (error) {
    next(error);
  }
};

// Request hint for current challenge
exports.requestHint = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Get user progress
    const progress = await Progress.findOne({ userId });
    if (!progress) {
      throw new AppError('Progress not found', 404);
    }
    
    // Check if time has expired
    if (progress.isTimeExpired()) {
      await progress.save();
      throw new AppError('Time has expired', 400);
    }
    
    // Get current challenge
    const currentChallenge = await Challenge.findOne({
      levelNumber: progress.currentLevel,
      enabled: true
    });
    
    if (!currentChallenge) {
      throw new AppError('Current challenge not found', 404);
    }
    
    // Check if hint was already used
    if (progress.isHintUsed(progress.currentLevel)) {
      return res.status(200).json({
        hint: currentChallenge.hint,
        message: 'Hint already revealed for this level'
      });
    }
    
    // Use hint
    progress.useHint(progress.currentLevel);
    await progress.save();
    
    res.status(200).json({
      hint: currentChallenge.hint,
      message: 'Hint revealed!'
    });
  } catch (error) {
    next(error);
  }
};

// Admin: Get all user progress (live monitoring)
exports.getLiveProgress = async (req, res, next) => {
  try {
    const progress = await Progress.find({})
      .populate('userId', 'name email institution')
      .sort({ lastActivity: -1 });
    
    // Update time remaining for each user
    const updatedProgress = progress.map(p => {
      const now = new Date();
      const elapsed = Math.floor((now - p.startTime) / 1000);
      const timeRemaining = Math.max(0, p.totalTimeLimit - elapsed);
      
      return {
        _id: p._id,
        user: p.userId,
        currentLevel: p.currentLevel,
        completedLevels: p.completedLevels,
        totalTimeLimit: p.totalTimeLimit,
        timeRemaining,
        completed: p.completed,
        timeExpired: timeRemaining <= 0 || p.timeExpired,
        finalScore: p.finalScore,
        startTime: p.startTime,
        lastActivity: p.lastActivity,
        totalAttempts: Array.from(p.levelAttempts.values()).reduce((sum, level) => sum + level.attempts, 0),
        hintsUsed: Array.from(p.levelHints.values()).filter(used => used).length
      };
    });
    
    res.status(200).json({
      status: 'success',
      results: updatedProgress.length,
      progress: updatedProgress
    });
  } catch (error) {
    next(error);
  }
};

// Admin: Get detailed user progress
exports.getUserProgress = async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    const progress = await Progress.findOne({ userId })
      .populate('userId', 'name email institution phone education location');
    
    if (!progress) {
      throw new AppError('Progress not found for this user', 404);
    }
    
    // Update time remaining
    const now = new Date();
    const elapsed = Math.floor((now - progress.startTime) / 1000);
    const timeRemaining = Math.max(0, progress.totalTimeLimit - elapsed);
    
    // Get detailed level attempts
    const levelAttempts = {};
    const levelHints = {};
    
    for (const [level, data] of progress.levelAttempts) {
      levelAttempts[level] = data;
    }
    
    for (const [level, used] of progress.levelHints) {
      levelHints[level] = used;
    }
    
    res.status(200).json({
      status: 'success',
      progress: {
        ...progress.toObject(),
        timeRemaining,
        timeExpired: timeRemaining <= 0 || progress.timeExpired,
        levelAttempts,
        levelHints
      }
    });
  } catch (error) {
    next(error);
  }
};

// Admin: Update user time limit
exports.updateUserTimeLimit = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { totalTimeLimit } = req.body;
    
    if (!totalTimeLimit || totalTimeLimit < 300) {
      throw new AppError('Time limit must be at least 5 minutes (300 seconds)', 400);
    }
    
    const progress = await Progress.findOne({ userId });
    if (!progress) {
      throw new AppError('Progress not found for this user', 404);
    }
    
    // Calculate current elapsed time
    const now = new Date();
    const elapsed = Math.floor((now - progress.startTime) / 1000);
    
    // Update time limit and remaining time
    progress.totalTimeLimit = totalTimeLimit;
    progress.timeRemaining = Math.max(0, totalTimeLimit - elapsed);
    
    // Check if user should be marked as time expired
    if (progress.timeRemaining <= 0) {
      progress.timeExpired = true;
    }
    
    await progress.save();
    
    res.status(200).json({
      status: 'success',
      message: 'Time limit updated successfully',
      progress: {
        totalTimeLimit: progress.totalTimeLimit,
        timeRemaining: progress.timeRemaining,
        timeExpired: progress.timeExpired
      }
    });
  } catch (error) {
    next(error);
  }
};

// Admin: Reset user progress
exports.resetUserProgress = async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    const progress = await Progress.findOne({ userId });
    if (!progress) {
      throw new AppError('Progress not found for this user', 404);
    }
    
    // Reset progress but keep user ID and time settings
    const timeLimit = progress.totalTimeLimit;
    
    Object.assign(progress, {
      startTime: new Date(),
      timeRemaining: timeLimit,
      currentLevel: 1,
      completedLevels: [],
      completed: false,
      completedAt: null,
      levelAttempts: new Map(),
      levelHints: new Map(),
      lastActivity: new Date(),
      finalScore: 0,
      timeExpired: false
    });
    
    await progress.save();
    
    res.status(200).json({
      status: 'success',
      message: 'User progress reset successfully',
      progress
    });
  } catch (error) {
    next(error);
  }
};

// Get challenge statistics
exports.getChallengeStats = async (req, res, next) => {
  try {
    const totalChallenges = await Challenge.countDocuments({ enabled: true });
    const totalUsers = await Progress.countDocuments();
    const completedUsers = await Progress.countDocuments({ completed: true });
    const activeUsers = await Progress.countDocuments({ 
      completed: false, 
      timeExpired: false 
    });
    
    // Get level completion statistics
    const levelStats = await Progress.aggregate([
      { $unwind: '$completedLevels' },
      { $group: { _id: '$completedLevels', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    
    res.status(200).json({
      status: 'success',
      stats: {
        totalChallenges,
        totalUsers,
        completedUsers,
        activeUsers,
        completionRate: totalUsers > 0 ? (completedUsers / totalUsers * 100).toFixed(2) : 0,
        levelStats
      }
    });
  } catch (error) {
    next(error);
  }
};