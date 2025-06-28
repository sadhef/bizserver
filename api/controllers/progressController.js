const Progress = require('../models/Progress');
const User = require('../models/User');
const Challenge = require('../models/Challenge');
const Setting = require('../models/Setting');
const { AppError } = require('../../utils/errorHandler');

// Get all progress (admin only)
exports.getAllProgress = async (req, res, next) => {
  try {
    const progress = await Progress.find()
      .populate('userId', 'name email institution')
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      status: 'success',
      results: progress.length,
      progress
    });
  } catch (error) {
    next(error);
  }
};

// Get current user's progress
exports.getMyProgress = async (req, res, next) => {
  try {
    const progress = await Progress.findOne({ userId: req.user.id });
    
    if (!progress) {
      throw new AppError('Progress not found', 404);
    }
    
    // Calculate remaining time
    const now = new Date();
    const startTime = new Date(progress.startTime);
    const totalTimeLimit = progress.totalTimeLimit || 3600;
    const elapsedSeconds = Math.floor((now - startTime) / 1000);
    const timeRemaining = Math.max(totalTimeLimit - elapsedSeconds, 0);
    
    // Update time remaining
    progress.timeRemaining = timeRemaining;
    await progress.save();
    
    res.status(200).json({
      status: 'success',
      progress
    });
  } catch (error) {
    next(error);
  }
};

// Get progress statistics (admin only)
exports.getProgressStats = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalChallenges = await Challenge.countDocuments({ enabled: true });
    
    const allProgress = await Progress.find();
    
    const completedUsers = allProgress.filter(p => p.completed).length;
    const activeUsers = allProgress.filter(p => !p.completed && p.timeRemaining > 0).length;
    const expiredUsers = allProgress.filter(p => !p.completed && p.timeRemaining <= 0).length;
    
    // Calculate average completion time
    const completedProgress = allProgress.filter(p => p.completed && p.completedAt);
    const avgCompletionTime = completedProgress.length > 0 
      ? completedProgress.reduce((sum, p) => {
          const completionTime = new Date(p.completedAt) - new Date(p.startTime);
          return sum + completionTime;
        }, 0) / completedProgress.length
      : 0;
    
    // Level completion stats
    const levelCompletion = {};
    for (let i = 1; i <= totalChallenges; i++) {
      const levelCompleted = allProgress.filter(p => 
        p.levelStatus && p.levelStatus.get(i.toString()) === true
      ).length;
      levelCompletion[i] = {
        completed: levelCompleted,
        percentage: totalUsers > 0 ? (levelCompleted / totalUsers) * 100 : 0
      };
    }
    
    // Get default time limit from settings
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

// Get progress for a specific user (admin only)
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

// Update progress for a user (admin only)
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
      
      const resetData = {
        currentLevel: 1,
        completed: false,
        timeRemaining: defaultTimeLimit,
        totalTimeLimit: defaultTimeLimit,
        startTime: new Date(),
        completedAt: null,
        levelStatus: new Map(),
        flagsAttempted: new Map(),
        attemptCounts: new Map(),
        hintsUsed: new Map()
      };
      
      const progress = await Progress.findOneAndUpdate(
        { userId: req.params.userId },
        resetData,
        { new: true, runValidators: true }
      );
      
      if (!progress) {
        throw new AppError('Progress not found', 404);
      }
      
      return res.status(200).json({
        status: 'success',
        message: 'Progress reset successfully',
        progress
      });
    }
    
    // Regular progress update
    const updateData = {};
    if (currentLevel !== undefined) updateData.currentLevel = currentLevel;
    if (timeRemaining !== undefined) updateData.timeRemaining = timeRemaining;
    if (totalTimeLimit !== undefined) updateData.totalTimeLimit = totalTimeLimit;
    if (completed !== undefined) {
      updateData.completed = completed;
      if (completed) {
        updateData.completedAt = new Date();
      } else {
        updateData.completedAt = null;
      }
    }
    
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

// Delete user progress (admin only)
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