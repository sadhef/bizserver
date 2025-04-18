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

// Get enabled challenges (admin only)
exports.getEnabledChallenges = async (req, res, next) => {
  try {
    const challenges = await Challenge.getEnabledChallenges();
    
    res.status(200).json({
      status: 'success',
      results: challenges.length,
      challenges
    });
  } catch (error) {
    next(error);
  }
};

// Create new challenge (admin only)
exports.createChallenge = async (req, res, next) => {
  try {
    const { levelNumber, title, description, hint, flag, enabled } = req.body;
    
    // Check if level already exists
    const existingLevel = await Challenge.findOne({ levelNumber });
    if (existingLevel) {
      throw new AppError(`Challenge with level number ${levelNumber} already exists`, 400);
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

// Get a specific challenge (admin only)
exports.getChallenge = async (req, res, next) => {
  try {
    const challenge = await Challenge.findById(req.params.id);
    
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

// Update a challenge (admin only)
exports.updateChallenge = async (req, res, next) => {
  try {
    const { levelNumber, title, description, hint, flag, enabled } = req.body;
    
    // If level number is changing, check for conflicts
    if (levelNumber) {
      const existingLevel = await Challenge.findOne({ 
        levelNumber, 
        _id: { $ne: req.params.id } 
      });
      
      if (existingLevel) {
        throw new AppError(`Challenge with level number ${levelNumber} already exists`, 400);
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
    // Get user's progress
    const progress = await Progress.findOne({ userId: req.user.id });
    
    if (!progress) {
      throw new AppError('User progress not found', 404);
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
    const elapsedSeconds = Math.floor((now - startTime) / 1000);
    const timeRemaining = Math.max(3600 - elapsedSeconds, 0);
    
    // Update time remaining
    progress.timeRemaining = timeRemaining;
    await progress.save();
    
    // Get attempt counts, hints used, etc.
    const currentLevel = progress.currentLevel.toString();
    const attemptCount = progress.attemptCounts.get(currentLevel) || 0;
    const hintUsed = progress.hintsUsed.get(currentLevel) || false;
    
    // Send modified challenge data without the flag
    const challengeData = {
      levelNumber: challenge.levelNumber,
      title: challenge.title,
      description: challenge.description,
      hint: hintUsed ? challenge.hint : null,
      attemptCount,
      hintUsed,
      timeRemaining
    };
    
    res.status(200).json({
      status: 'success',
      challenge: challengeData,
      progress: {
        currentLevel: progress.currentLevel,
        completedLevels: progress.getCompletedLevels(),
        timeRemaining
      }
    });
  } catch (error) {
    next(error);
  }
};

// Submit flag
exports.submitFlag = async (req, res, next) => {
  try {
    const { flag } = req.body;
    
    if (!flag) {
      throw new AppError('Please provide a flag', 400);
    }
    
    // Get user's progress
    const progress = await Progress.findOne({ userId: req.user.id });
    
    if (!progress) {
      throw new AppError('User progress not found', 404);
    }
    
    // Check if completed or time expired
    if (progress.completed || progress.timeRemaining <= 0) {
      return res.status(400).json({
        status: 'fail',
        message: progress.completed ? 'All challenges completed' : 'Time expired'
      });
    }
    
    // Get current level
    const currentLevel = progress.currentLevel;
    
    // Get the challenge
    const challenge = await Challenge.findOne({ 
      levelNumber: currentLevel,
      enabled: true
    });
    
    if (!challenge) {
      throw new AppError('Challenge not found', 404);
    }
    
    // Record the attempt
    await progress.addFlagAttempt(currentLevel, flag);
    
    // Check if flag is correct (case insensitive)
    const isCorrect = flag.toLowerCase() === challenge.flag.toLowerCase();
    
    if (isCorrect) {
      // Mark level as completed
      await progress.completeLevel(currentLevel);
      
      // Get number of enabled levels
      const totalLevels = await Challenge.getNumberOfLevels();
      
      // Check if this was the last level
      const isLastLevel = currentLevel >= totalLevels;
      
      if (isLastLevel) {
        // Mark as completed
        progress.completed = true;
        progress.completedAt = new Date();
      } else {
        // Move to next level
        progress.currentLevel = currentLevel + 1;
      }
      
      await progress.save();
      
      res.status(200).json({
        status: 'success',
        correct: true,
        message: isLastLevel ? 'Congratulations! You have completed all challenges!' : 'Correct flag! Moving to next level.',
        completed: isLastLevel,
        nextLevel: isLastLevel ? null : currentLevel + 1
      });
    } else {
      // Wrong flag
      res.status(200).json({
        status: 'success',
        correct: false,
        message: 'Incorrect flag. Try again!'
      });
    }
  } catch (error) {
    next(error);
  }
};

// Request hint
exports.requestHint = async (req, res, next) => {
  try {
    // Get user's progress
    const progress = await Progress.findOne({ userId: req.user.id });
    
    if (!progress) {
      throw new AppError('User progress not found', 404);
    }
    
    // Check if completed or time expired
    if (progress.completed || progress.timeRemaining <= 0) {
      return res.status(400).json({
        status: 'fail',
        message: progress.completed ? 'All challenges completed' : 'Time expired'
      });
    }
    
    // Get current level
    const currentLevel = progress.currentLevel;
    const levelStr = currentLevel.toString();
    
    // Check if hint already used
    if (progress.hintsUsed.get(levelStr)) {
      throw new AppError('Hint already used for this level', 400);
    }
    
    // Get the challenge
    const challenge = await Challenge.findOne({ 
      levelNumber: currentLevel,
      enabled: true
    });
    
    if (!challenge) {
      throw new AppError('Challenge not found', 404);
    }
    
    // Mark hint as used
    await progress.useHint(currentLevel);
    
    res.status(200).json({
      status: 'success',
      hint: challenge.hint
    });
  } catch (error) {
    next(error);
  }
};