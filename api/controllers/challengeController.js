const Challenge = require('../models/Challenge');
const Progress = require('../models/Progress');
const User = require('../models/User');
const Setting = require('../models/Setting');
const { AppError } = require('../../utils/errorHandler');

// Get current challenge for user (sequential access)
exports.getCurrentChallenge = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Check user approval status
    const user = await User.findById(userId);
    if (!user || user.status !== 'approved') {
      throw new AppError('Access denied. Account not approved.', 403);
    }
    
    // Get or create user progress
    const settings = await Setting.findOne() || { defaultTimeLimit: 3600 };
    let progress = await Progress.getOrCreateProgress(userId, settings);
    
    // Check if time has expired
    if (progress.isTimeExpired()) {
      await progress.save();
      return res.status(200).json({
        timeExpired: true,
        message: 'Time has expired. Redirecting to thank you page.',
        progress: {
          completed: progress.completed,
          timeExpired: true,
          finalScore: progress.finalScore,
          completedLevels: progress.completedLevels,
          totalTime: progress.totalTimeLimit,
          elapsedTime: Math.floor((new Date() - progress.startTime) / 1000)
        }
      });
    }
    
    // Get total number of enabled challenges
    const totalChallenges = await Challenge.countDocuments({ enabled: true });
    
    // Check if all challenges are completed
    if (progress.completedLevels.length >= totalChallenges) {
      progress.completed = true;
      progress.completedAt = new Date();
      await progress.save();
      
      return res.status(200).json({
        completed: true,
        message: 'Congratulations! All challenges completed!',
        progress: {
          completed: true,
          completedLevels: progress.completedLevels,
          finalScore: progress.finalScore,
          completedAt: progress.completedAt,
          totalChallenges
        }
      });
    }
    
    // Get current challenge (user can only access current level)
    const currentChallenge = await Challenge.findOne({
      levelNumber: progress.currentLevel,
      enabled: true
    }).select('-flag'); // Don't send flag to frontend
    
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
    progress.lastActivity = new Date();
    await progress.save();
    
    res.status(200).json({
      success: true,
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
        totalLevels: totalChallenges,
        difficulty: currentChallenge.difficulty,
        points: currentChallenge.points
      },
      progress: {
        currentLevel: progress.currentLevel,
        completedLevels: progress.completedLevels,
        totalTimeLimit: progress.totalTimeLimit,
        timeRemaining,
        completed: progress.completed,
        startTime: progress.startTime,
        finalScore: progress.finalScore,
        totalChallenges
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
      throw new AppError('Progress not found. Please start the challenge first.', 404);
    }
    
    // Check if time has expired
    if (progress.isTimeExpired()) {
      await progress.save();
      throw new AppError('Time has expired. You cannot submit flags anymore.', 400);
    }
    
    // Check if user has already completed all challenges
    if (progress.completed) {
      throw new AppError('You have already completed all challenges.', 400);
    }
    
    // Get current challenge
    const currentChallenge = await Challenge.findOne({
      levelNumber: progress.currentLevel,
      enabled: true
    });
    
    if (!currentChallenge) {
      throw new AppError('Current challenge not found', 404);
    }
    
    // Add flag attempt to progress
    progress.addFlagAttempt(progress.currentLevel, flag.trim());
    
    // Check if flag is correct (case-insensitive comparison)
    const isCorrect = currentChallenge.flag.trim().toLowerCase() === flag.trim().toLowerCase();
    
    if (isCorrect) {
      // Complete current level
      progress.completeLevel(progress.currentLevel);
      
      // Calculate score with bonuses and penalties
      const basePoints = currentChallenge.points || 100;
      const hintPenalty = progress.isHintUsed(currentChallenge.levelNumber) ? 20 : 0;
      const attemptPenalty = Math.max(0, (attemptCount - 1) * 5); // Penalty for multiple attempts
      const timeBonus = progress.timeRemaining > progress.totalTimeLimit * 0.5 ? 10 : 0;
      
      const levelScore = Math.max(basePoints - hintPenalty - attemptPenalty + timeBonus, 10);
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
        success: true,
        correct: true,
        completed: allCompleted,
        message: allCompleted 
          ? 'Congratulations! You have completed all challenges!' 
          : `Correct! Level ${currentChallenge.levelNumber} completed. Moving to Level ${progress.currentLevel}.`,
        levelScore,
        totalScore: progress.finalScore,
        nextLevel: allCompleted ? null : progress.currentLevel,
        completedLevels: progress.completedLevels,
        timeRemaining: progress.timeRemaining
      });
    } else {
      await progress.save();
      
      const currentAttempts = progress.levelAttempts.get(progress.currentLevel.toString())?.attempts || 0;
      
      res.status(200).json({
        success: true,
        correct: false,
        message: 'Incorrect flag. Please try again!',
        attempts: currentAttempts,
        hint: currentAttempts >= 3 && !progress.isHintUsed(progress.currentLevel) 
          ? 'Having trouble? Consider using the hint!' 
          : null
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
        success: true,
        hint: currentChallenge.hint,
        message: 'Hint already revealed for this level',
        alreadyUsed: true
      });
    }
    
    // Use hint
    progress.useHint(progress.currentLevel);
    await progress.save();
    
    res.status(200).json({
      success: true,
      hint: currentChallenge.hint,
      message: 'Hint revealed! (Score penalty: -20 points)',
      alreadyUsed: false
    });
  } catch (error) {
    next(error);
  }
};

// Admin: Create new challenge
exports.createChallenge = async (req, res, next) => {
  try {
    const {
      levelNumber,
      title,
      description,
      hint,
      flag,
      difficulty = 'easy',
      points = 100,
      category = 'general',
      timeLimit = 60
    } = req.body;
    
    // Validate required fields
    if (!levelNumber || !title || !description || !hint || !flag) {
      throw new AppError('All required fields must be provided', 400);
    }
    
    // Check if level number already exists
    const existingChallenge = await Challenge.findOne({ levelNumber });
    if (existingChallenge) {
      throw new AppError('Challenge with this level number already exists', 400);
    }
    
    const challenge = await Challenge.create({
      levelNumber,
      title: title.trim(),
      description: description.trim(),
      hint: hint.trim(),
      flag: flag.trim(),
      difficulty,
      points: parseInt(points),
      category,
      timeLimit: parseInt(timeLimit),
      createdBy: req.user.id,
      enabled: true
    });
    
    res.status(201).json({
      success: true,
      message: 'Challenge created successfully',
      challenge: {
        _id: challenge._id,
        levelNumber: challenge.levelNumber,
        title: challenge.title,
        description: challenge.description,
        difficulty: challenge.difficulty,
        points: challenge.points,
        category: challenge.category,
        enabled: challenge.enabled
      }
    });
  } catch (error) {
    next(error);
  }
};

// Admin: Get all challenges
exports.getAdminChallenges = async (req, res, next) => {
  try {
    const challenges = await Challenge.find({})
      .sort({ levelNumber: 1 })
      .populate('createdBy', 'name email');
    
    res.status(200).json({
      success: true,
      results: challenges.length,
      challenges
    });
  } catch (error) {
    next(error);
  }
};

// Admin: Update challenge
exports.updateChallenge = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Remove sensitive fields that shouldn't be updated via this route
    delete updateData.createdBy;
    delete updateData.createdAt;
    
    const challenge = await Challenge.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    
    if (!challenge) {
      throw new AppError('Challenge not found', 404);
    }
    
    res.status(200).json({
      success: true,
      message: 'Challenge updated successfully',
      challenge
    });
  } catch (error) {
    next(error);
  }
};

// Admin: Delete challenge
exports.deleteChallenge = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const challenge = await Challenge.findByIdAndDelete(id);
    if (!challenge) {
      throw new AppError('Challenge not found', 404);
    }
    
    // Note: You might want to handle progress cleanup here
    // or mark the challenge as deleted instead of hard delete
    
    res.status(200).json({
      success: true,
      message: 'Challenge deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Admin: Get live progress monitoring
exports.getLiveProgress = async (req, res, next) => {
  try {
    const progress = await Progress.find({})
      .populate('userId', 'name email institution registrationTime')
      .sort({ lastActivity: -1 });
    
    // Update time remaining for each user and format data
    const liveData = progress.map(p => {
      const now = new Date();
      const elapsed = Math.floor((now - p.startTime) / 1000);
      const timeRemaining = Math.max(0, p.totalTimeLimit - elapsed);
      const isTimeExpired = timeRemaining <= 0 || p.timeExpired;
      
      // Calculate total attempts across all levels
      const totalAttempts = Array.from(p.levelAttempts.values())
        .reduce((sum, level) => sum + level.attempts, 0);
      
      // Calculate hints used
      const hintsUsed = Array.from(p.levelHints.values())
        .filter(used => used).length;
      
      return {
        _id: p._id,
        user: p.userId,
        currentLevel: p.currentLevel,
        completedLevels: p.completedLevels,
        totalTimeLimit: p.totalTimeLimit,
        timeRemaining,
        completed: p.completed,
        timeExpired: isTimeExpired,
        finalScore: p.finalScore,
        startTime: p.startTime,
        lastActivity: p.lastActivity,
        totalAttempts,
        hintsUsed,
        progressPercentage: Math.round((p.completedLevels.length / 10) * 100) // Assuming 10 levels max
      };
    });
    
    res.status(200).json({
      success: true,
      results: liveData.length,
      progress: liveData
    });
  } catch (error) {
    next(error);
  }
};

// Admin: Set global time limit for all users
exports.setGlobalTimeLimit = async (req, res, next) => {
  try {
    const { timeLimit } = req.body; // in seconds
    
    if (!timeLimit || timeLimit < 300) { // Minimum 5 minutes
      throw new AppError('Time limit must be at least 5 minutes (300 seconds)', 400);
    }
    
    // Update or create global settings
    let settings = await Setting.findOne();
    if (!settings) {
      settings = new Setting();
    }
    
    settings.defaultTimeLimit = timeLimit;
    await settings.save();
    
    // Update all active user progress
    const activeProgress = await Progress.find({ 
      completed: false, 
      timeExpired: false 
    });
    
    for (let progress of activeProgress) {
      const elapsed = Math.floor((new Date() - progress.startTime) / 1000);
      progress.totalTimeLimit = timeLimit;
      progress.timeRemaining = Math.max(0, timeLimit - elapsed);
      
      if (progress.timeRemaining <= 0) {
        progress.timeExpired = true;
      }
      
      await progress.save();
    }
    
    res.status(200).json({
      success: true,
      message: 'Global time limit updated successfully',
      timeLimit,
      affectedUsers: activeProgress.length
    });
  } catch (error) {
    next(error);
  }
};

// Get user's final results (for thank you page)
exports.getUserResults = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const progress = await Progress.findOne({ userId })
      .populate('userId', 'name email institution');
    
    if (!progress) {
      throw new AppError('Progress not found', 404);
    }
    
    const totalChallenges = await Challenge.countDocuments({ enabled: true });
    const completionPercentage = Math.round((progress.completedLevels.length / totalChallenges) * 100);
    
    // Calculate final stats
    const totalAttempts = Array.from(progress.levelAttempts.values())
      .reduce((sum, level) => sum + level.attempts, 0);
    
    const hintsUsed = Array.from(progress.levelHints.values())
      .filter(used => used).length;
    
    const timeUsed = progress.totalTimeLimit - progress.timeRemaining;
    
    res.status(200).json({
      success: true,
      results: {
        user: progress.userId,
        finalScore: progress.finalScore,
        completedLevels: progress.completedLevels.length,
        totalChallenges,
        completionPercentage,
        timeUsed,
        totalTimeLimit: progress.totalTimeLimit,
        totalAttempts,
        hintsUsed,
        completed: progress.completed,
        timeExpired: progress.timeExpired,
        startTime: progress.startTime,
        endTime: progress.completedAt || new Date()
      }
    });
  } catch (error) {
    next(error);
  }
};