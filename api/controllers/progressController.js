const Progress = require('../models/Progress');
const User = require('../models/User');
const Challenge = require('../models/Challenge');
const Setting = require('../models/Setting');
const { AppError } = require('../../utils/errorHandler');

/**
 * Get progress for the current user
 * @route GET /api/progress/my-progress
 * @access Private (User)
 */
exports.getMyProgress = async (req, res, next) => {
  try {
    const progress = await Progress.findOne({ userId: req.user.id });
    
    if (!progress) {
      throw new AppError('Progress not found for this user', 404);
    }
    
    // Calculate current time remaining
    const now = new Date();
    const startTime = new Date(progress.startTime);
    const totalTimeLimit = progress.totalTimeLimit || 3600; // Default to 1 hour if not set
    const elapsedSeconds = Math.floor((now - startTime) / 1000);
    const timeRemaining = Math.max(totalTimeLimit - elapsedSeconds, 0);
    
    // Update time remaining
    progress.timeRemaining = timeRemaining;
    await progress.save();
    
    // Get completed levels
    const completedLevels = progress.getCompletedLevels();
    
    // Get total available levels
    const totalLevels = await Challenge.getNumberOfLevels();
    
    const progressData = {
      currentLevel: progress.currentLevel,
      timeRemaining,
      totalTimeLimit: progress.totalTimeLimit,
      completedLevels,
      totalLevels,
      completed: progress.completed,
      startTime: progress.startTime,
      lastUpdated: progress.lastUpdated
    };
    
    res.status(200).json({
      status: 'success',
      progress: progressData
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all user progress (admin only)
 * @route GET /api/progress
 * @access Private (Admin)
 */
exports.getAllProgress = async (req, res, next) => {
  try {
    const progress = await Progress.find().sort({ lastUpdated: -1 });
    
    res.status(200).json({
      status: 'success',
      results: progress.length,
      progress
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get progress statistics (admin only)
 * @route GET /api/progress/stats
 * @access Private (Admin)
 */
exports.getProgressStats = async (req, res, next) => {
  try {
    // Get total users
    const totalUsers = await User.countDocuments();
    
    // Get total challenges
    const totalChallenges = await Challenge.countDocuments({ enabled: true });
    
    // Get users who completed all challenges
    const completedUsers = await Progress.countDocuments({ completed: true });
    
    // Get users who are still in progress
    const activeUsers = await Progress.countDocuments({
      completed: false,
      timeRemaining: { $gt: 0 }
    });
    
    // Get users whose time expired
    const expiredUsers = await Progress.countDocuments({
      completed: false,
      timeRemaining: 0
    });
    
    // Get level completion stats
    const levelStats = await Progress.aggregate([
      { $unwind: '$levelStatus' },
      { $match: { 'levelStatus.v': true } },
      { $group: { _id: '$levelStatus.k', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    
    // Format level stats
    const levelCompletion = {};
    levelStats.forEach(stat => {
      levelCompletion[stat._id] = stat.count;
    });
    
    // Get average completion time
    const completedProgress = await Progress.find({ completed: true });
    let avgCompletionTime = 0;
    
    if (completedProgress.length > 0) {
      const totalTime = completedProgress.reduce((sum, p) => {
        const startTime = new Date(p.startTime);
        const endTime = new Date(p.completedAt || p.lastUpdated);
        return sum + (endTime - startTime) / 1000;
      }, 0);
      
      avgCompletionTime = Math.round(totalTime / completedProgress.length);
    }
    
    // Get current default time limit setting
    const settings = await Setting.findOne();
    const defaultTimeLimit = settings ? settings.defaultTimeLimit : 3600;
    
    res.status(200).json({
      status: 'success',
      stats: {
        totalUsers,
        totalChallenges,
        completedUsers,
        activeUsers,
        expiredUsers,
        completionRate: totalUsers ? (completedUsers / totalUsers) * 100 : 0,
        levelCompletion,
        avgCompletionTime,
        defaultTimeLimit
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get progress for a specific user (admin only)
 * @route GET /api/progress/:userId
 * @access Private (Admin)
 */
exports.getUserProgress = async (req, res, next) => {
  try {
    const progress = await Progress.findOne({ userId: req.params.userId });
    
    if (!progress) {
      throw new AppError('Progress not found', 404);
    }
    
    // Get user info
    const user = await User.findById(req.params.userId);
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    // Get completed levels
    const completedLevels = progress.getCompletedLevels();
    
    // Get level attempt details
    const levelAttempts = {};
    progress.flagsAttempted.forEach((attempts, level) => {
      levelAttempts[level] = {
        attempts: attempts.length,
        flags: attempts
      };
    });
    
    // Get level hint usage
    const levelHints = {};
    progress.hintsUsed.forEach((used, level) => {
      levelHints[level] = used;
    });
    
    res.status(200).json({
      status: 'success',
      progress: {
        ...progress.toObject(),
        user: {
          id: user._id,
          name: user.name,
          email: user.email
        },
        completedLevels,
        levelAttempts,
        levelHints
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update progress for a user (admin only)
 * @route PATCH /api/progress/:userId
 * @access Private (Admin)
 */
exports.updateUserProgress = async (req, res, next) => {
  try {
    const {
      currentLevel,
      timeRemaining,
      totalTimeLimit,
      completed,
      resetProgress
    } = req.body;
    
    // Handle reset progress option
    if (resetProgress) {
      // Get current settings for default time limit
      const settings = await Setting.findOne();
      const defaultTimeLimit = settings ? settings.defaultTimeLimit : 3600;
      
      await Progress.findOneAndUpdate(
        { userId: req.params.userId },
        {
          currentLevel: 1,
          totalTimeLimit: defaultTimeLimit,
          timeRemaining: defaultTimeLimit,
          levelStatus: new Map(),
          flagsAttempted: new Map(),
          attemptCounts: new Map(),
          hintsUsed: new Map(),
          completed: false,
          completedAt: null,
          startTime: new Date(),
          lastUpdated: new Date()
        },
        { new: true, runValidators: true }
      );
      
      return res.status(200).json({
        status: 'success',
        message: 'User progress has been reset'
      });
    }
    
    // Update specific fields
    const updateData = {};
    
    if (currentLevel !== undefined) {
      updateData.currentLevel = currentLevel;
    }
    
    if (timeRemaining !== undefined) {
      updateData.timeRemaining = timeRemaining;
    }
    
    if (totalTimeLimit !== undefined) {
      updateData.totalTimeLimit = totalTimeLimit;
      
      // If time limit is being updated, also update remaining time proportionally
      if (timeRemaining === undefined) {
        const progress = await Progress.findOne({ userId: req.params.userId });
        if (progress) {
          // Calculate new remaining time proportionally if user already started
          const oldTimeLimit = progress.totalTimeLimit || 3600;
          const oldTimeRemaining = progress.timeRemaining || 0;
          const ratio = oldTimeRemaining / oldTimeLimit;
          
          updateData.timeRemaining = Math.round(totalTimeLimit * ratio);
        } else {
          updateData.timeRemaining = totalTimeLimit;
        }
      }
    }
    
    if (completed !== undefined) {
      updateData.completed = completed;
      if (completed) {
        updateData.completedAt = new Date();
      } else {
        updateData.completedAt = null;
      }
    }
    
    updateData.lastUpdated = new Date();
    
    const progress = await Progress.findOneAndUpdate(
      { userId: req.params.userId },
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!progress) {
      throw new AppError('Progress not found', 404);
    }
    
    res.status(200).json({
      status: 'success',
      progress
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete progress for a user (admin only)
 * @route DELETE /api/progress/:userId
 * @access Private (Admin)
 */
exports.deleteUserProgress = async (req, res, next) => {
  try {
    const progress = await Progress.findOneAndDelete({ userId: req.params.userId });
    
    if (!progress) {
      throw new AppError('Progress not found', 404);
    }
    
    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (error) {
    next(error);
  }
};