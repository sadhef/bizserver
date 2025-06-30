const Challenge = require('../models/Challenge');
const Progress = require('../models/Progress');
const { AppError } = require('../../utils/errorHandler');

// Get all challenges (admin only)
exports.getAllChallenges = async (req, res, next) => {
  try {
    const challenges = await Challenge.find().sort({ levelNumber: 1 });
    
    res.status(200).json({
      status: 'success',
      results: challenges.length,
      challenges
    });
  } catch (error) {
    next(error);
  }
};

// Create a new challenge (admin only)
exports.createChallenge = async (req, res, next) => {
  try {
    const { levelNumber, title, description, hint, flag, enabled } = req.body;
    
    // Check if level number already exists
    const existingChallenge = await Challenge.findOne({ levelNumber });
    if (existingChallenge) {
      throw new AppError('A challenge with this level number already exists', 400);
    }
    
    const challenge = await Challenge.create({
      levelNumber,
      title,
      description,
      hint,
      flag,
      enabled: enabled !== undefined ? enabled : true
    });
    
    res.status(201).json({
      status: 'success',
      challenge
    });
  } catch (error) {
    next(error);
  }
};

// Update a challenge (admin only)
exports.updateChallenge = async (req, res, next) => {
  try {
    const { levelNumber, title, description, hint, flag, enabled } = req.body;
    
    // If updating level number, check if it already exists (excluding current challenge)
    if (levelNumber) {
      const existingChallenge = await Challenge.findOne({ 
        levelNumber, 
        _id: { $ne: req.params.id } 
      });
      if (existingChallenge) {
        throw new AppError('A challenge with this level number already exists', 400);
      }
    }
    
    const challenge = await Challenge.findByIdAndUpdate(
      req.params.id,
      {
        levelNumber,
        title,
        description,
        hint,
        flag,
        enabled,
        updatedAt: Date.now()
      },
      { 
        new: true,
        runValidators: true
      }
    );
    
    if (!challenge) {
      throw new AppError('Challenge not found', 404);
    }
    
    res.status(200).json({
      status: 'success',
      challenge
    });
  } catch (error) {
    next(error);
  }
};

// Delete a challenge (admin only)
exports.deleteChallenge = async (req, res, next) => {
  try {
    const challenge = await Challenge.findByIdAndDelete(req.params.id);
    
    if (!challenge) {
      throw new AppError('Challenge not found', 404);
    }
    
    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (error) {
    next(error);
  }
};

// Get current user's challenge
exports.getCurrentChallenge = async (req, res, next) => {
  try {
    // Get user's progress or create if doesn't exist
    let progress = await Progress.findOne({ userId: req.user.id });
    
    if (!progress) {
      console.log('No progress found for user in getCurrentChallenge:', req.user.id, '- creating new progress');
      
      try {
        // Use the static method that gets time limit from settings
        progress = await Progress.createWithTimeLimit(req.user.id);
        console.log('Progress created successfully in getCurrentChallenge for user:', req.user.id);
      } catch (createError) {
        console.error('Error creating progress in getCurrentChallenge:', createError);
        throw new AppError('Failed to initialize user progress', 500);
      }
    }
    
    // Check if completed
    if (progress.completed) {
      return res.status(200).json({
        status: 'success',
        message: 'All challenges completed',
        completed: true,
        timeRemaining: progress.timeRemaining
      });
    }
    
    // Check if time expired
    if (progress.timeRemaining <= 0) {
      return res.status(200).json({
        status: 'success',
        message: 'Time expired',
        timeExpired: true,
        timeRemaining: 0
      });
    }
    
    // Get current level challenge
    const challenge = await Challenge.findOne({ 
      levelNumber: progress.currentLevel,
      enabled: true
    });
    
    if (!challenge) {
      throw new AppError('Challenge not found', 404);
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
    
    // Get attempt counts, hints used, etc.
    const currentLevel = progress.currentLevel.toString();
    const attemptCount = progress.attemptCounts?.get(currentLevel) || 0;
    const hintUsed = progress.hintsUsed?.get(currentLevel) || false;
    
    // Get total number of challenges
    const totalLevels = await Challenge.getNumberOfLevels();
    
    // Send modified challenge data without the flag
    const challengeData = {
      levelNumber: challenge.levelNumber,
      title: challenge.title,
      description: challenge.description,
      hint: hintUsed ? challenge.hint : null,
      attemptCount,
      hintUsed,
      timeRemaining,
      totalLevels
    };
    
    res.status(200).json({
      status: 'success',
      challenge: challengeData
    });
  } catch (error) {
    next(error);
  }
};

// Submit flag for current challenge
exports.submitFlag = async (req, res, next) => {
  try {
    const { flag } = req.body;
    
    if (!flag) {
      throw new AppError('Flag is required', 400);
    }
    
    // Get user's progress
    let progress = await Progress.findOne({ userId: req.user.id });
    
    if (!progress) {
      console.log('No progress found for user in submitFlag:', req.user.id, '- creating new progress');
      
      try {
        // Use the static method that gets time limit from settings
        progress = await Progress.createWithTimeLimit(req.user.id);
        console.log('Progress created successfully in submitFlag for user:', req.user.id);
      } catch (createError) {
        console.error('Error creating progress in submitFlag:', createError);
        throw new AppError('Failed to initialize user progress', 500);
      }
    }
    
    // Check if time expired
    if (progress.timeRemaining <= 0) {
      throw new AppError('Time has expired', 400);
    }
    
    // Get current challenge
    const challenge = await Challenge.findOne({ 
      levelNumber: progress.currentLevel,
      enabled: true
    });
    
    if (!challenge) {
      throw new AppError('Challenge not found', 404);
    }
    
    const currentLevel = progress.currentLevel.toString();
    
    // Initialize Maps if they don't exist
    if (!progress.flagsAttempted || !(progress.flagsAttempted instanceof Map)) {
      progress.flagsAttempted = new Map();
    }
    if (!progress.attemptCounts || !(progress.attemptCounts instanceof Map)) {
      progress.attemptCounts = new Map();
    }
    if (!progress.levelStatus || !(progress.levelStatus instanceof Map)) {
      progress.levelStatus = new Map();
    }
    
    // Record the flag attempt
    if (!progress.flagsAttempted.has(currentLevel)) {
      progress.flagsAttempted.set(currentLevel, []);
    }
    const attempts = progress.flagsAttempted.get(currentLevel);
    attempts.push({
      flag,
      timestamp: new Date(),
      correct: flag.trim() === challenge.flag.trim()
    });
    progress.flagsAttempted.set(currentLevel, attempts);
    
    // Update attempt count
    const currentAttempts = progress.attemptCounts.get(currentLevel) || 0;
    progress.attemptCounts.set(currentLevel, currentAttempts + 1);
    
    // Check if flag is correct
    if (flag.trim() === challenge.flag.trim()) {
      // Mark level as completed
      progress.levelStatus.set(currentLevel, true);
      
      // Check if this is the last level
      const totalChallenges = await Challenge.countDocuments({ enabled: true });
      
      if (progress.currentLevel >= totalChallenges) {
        // All challenges completed
        progress.completed = true;
        progress.completedAt = new Date();
        
        await progress.save();
        
        return res.status(200).json({
          status: 'success',
          message: 'Congratulations! All challenges completed!',
          correct: true,
          completed: true,
          timeRemaining: progress.timeRemaining
        });
      } else {
        // Move to next level
        progress.currentLevel += 1;
        await progress.save();
        
        return res.status(200).json({
          status: 'success',
          message: 'Correct! Moving to next level.',
          correct: true,
          nextLevel: progress.currentLevel,
          timeRemaining: progress.timeRemaining
        });
      }
    } else {
      // Wrong flag
      await progress.save();
      
      return res.status(200).json({
        status: 'success',
        message: 'Incorrect flag. Try again!',
        correct: false,
        attempts: progress.attemptCounts.get(currentLevel),
        timeRemaining: progress.timeRemaining
      });
    }
  } catch (error) {
    next(error);
  }
};

// Get hint for current challenge
exports.getHint = async (req, res, next) => {
  try {
    // Get user's progress
    let progress = await Progress.findOne({ userId: req.user.id });
    
    if (!progress) {
      console.log('No progress found for user in getHint:', req.user.id, '- creating new progress');
      
      try {
        // Use the static method that gets time limit from settings
        progress = await Progress.createWithTimeLimit(req.user.id);
        console.log('Progress created successfully in getHint for user:', req.user.id);
      } catch (createError) {
        console.error('Error creating progress in getHint:', createError);
        throw new AppError('Failed to initialize user progress', 500);
      }
    }
    
    // Check if time expired
    if (progress.timeRemaining <= 0) {
      throw new AppError('Time has expired', 400);
    }
    
    // Get current challenge
    const challenge = await Challenge.findOne({ 
      levelNumber: progress.currentLevel,
      enabled: true
    });
    
    if (!challenge) {
      throw new AppError('Challenge not found', 404);
    }
    
    const currentLevel = progress.currentLevel.toString();
    
    // Initialize hintsUsed Map if it doesn't exist
    if (!progress.hintsUsed || !(progress.hintsUsed instanceof Map)) {
      progress.hintsUsed = new Map();
    }
    
    // Mark hint as used
    progress.hintsUsed.set(currentLevel, true);
    await progress.save();
    
    res.status(200).json({
      status: 'success',
      hint: challenge.hint,
      timeRemaining: progress.timeRemaining
    });
  } catch (error) {
    next(error);
  }
};

module.exports = exports;