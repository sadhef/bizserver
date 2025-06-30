const Challenge = require('../models/Challenge');
const Progress = require('../models/Progress');
const Setting = require('../models/Setting');
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

// ENHANCED: Get current user's challenge with proper settings integration
exports.getCurrentChallenge = async (req, res, next) => {
  try {
    console.log('🎯 getCurrentChallenge called for user:', req.user.id);
    
    // Get user's progress
    let progress = await Progress.findOne({ userId: req.user.id });
    
    if (!progress) {
      console.log('⚠️ No progress found, creating new progress with current settings');
      
      // Create progress using the static method that gets settings
      try {
        progress = await Progress.createWithTimeLimit(req.user.id);
        console.log('✅ Created new progress with time limit:', progress.totalTimeLimit, 'seconds');
      } catch (createError) {
        console.error('❌ Error creating progress with settings:', createError);
        
        // Fallback: create basic progress
        progress = new Progress({
          userId: req.user.id,
          startTime: new Date(),
          totalTimeLimit: 3600, // 1 hour default
          timeRemaining: 3600,
          currentLevel: 1,
          completed: false
        });
        await progress.save();
        console.log('✅ Created fallback progress');
      }
    } else {
      console.log('📊 Found existing progress:', {
        timeLimit: progress.totalTimeLimit,
        timeRemaining: progress.timeRemaining,
        currentLevel: progress.currentLevel
      });
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
    
    // Calculate current time remaining based on elapsed time
    const now = new Date();
    const startTime = new Date(progress.startTime);
    const totalTimeLimit = progress.totalTimeLimit || 3600;
    const elapsedSeconds = Math.floor((now - startTime) / 1000);
    const actualTimeRemaining = Math.max(totalTimeLimit - elapsedSeconds, 0);
    
    console.log('⏱️ Time calculation:', {
      totalTimeLimit,
      elapsedSeconds,
      actualTimeRemaining,
      storedTimeRemaining: progress.timeRemaining
    });
    
    // Check if time expired
    if (actualTimeRemaining <= 0) {
      return res.status(200).json({
        status: 'success',
        message: 'Time expired',
        timeExpired: true,
        timeRemaining: 0
      });
    }
    
    // Update time remaining in database
    progress.timeRemaining = actualTimeRemaining;
    await progress.save();
    
    // Get current level challenge
    const challenge = await Challenge.findOne({ 
      levelNumber: progress.currentLevel,
      enabled: true
    });
    
    console.log('🔍 Looking for challenge with level:', progress.currentLevel);
    
    if (!challenge) {
      console.error('❌ No challenge found for level:', progress.currentLevel);
      
      // Check if any challenges exist
      const totalChallenges = await Challenge.countDocuments({ enabled: true });
      console.log('📈 Total challenges available:', totalChallenges);
      
      if (totalChallenges === 0) {
        return res.status(200).json({
          status: 'success',
          message: 'No challenges available yet. Please contact administrator.',
          noChallenges: true
        });
      }
      
      // If user is beyond available challenges, mark as completed
      if (progress.currentLevel > totalChallenges) {
        progress.completed = true;
        progress.completedAt = new Date();
        await progress.save();
        
        return res.status(200).json({
          status: 'success',
          message: 'All challenges completed',
          completed: true,
          timeRemaining: actualTimeRemaining
        });
      }
      
      throw new AppError(`Challenge not found for level ${progress.currentLevel}`, 404);
    }
    
    console.log('✅ Found challenge:', challenge.title);
    
    // Get attempt counts, hints used, etc.
    const currentLevel = progress.currentLevel.toString();
    const attemptCount = progress.attemptCounts.get(currentLevel) || 0;
    const hintUsed = progress.hintsUsed.get(currentLevel) || false;
    
    console.log('📊 Level stats:', {
      currentLevel,
      attemptCount,
      hintUsed,
      totalAttempts: progress.attemptCounts.size
    });
    
    // Send modified challenge data without the flag
    const challengeData = {
      levelNumber: challenge.levelNumber,
      title: challenge.title,
      description: challenge.description,
      hint: hintUsed ? challenge.hint : null,
      attemptCount,
      hintUsed,
      timeRemaining: actualTimeRemaining,
      totalTimeLimit: totalTimeLimit
    };
    
    console.log('✅ Sending challenge data with attempts:', attemptCount);
    
    res.status(200).json({
      status: 'success',
      challenge: challengeData
    });
  } catch (error) {
    console.error('❌ getCurrentChallenge error:', error);
    next(error);
  }
};

// FIXED: Submit flag with proper attempt tracking
exports.submitFlag = async (req, res, next) => {
  try {
    const { flag } = req.body;
    
    if (!flag) {
      throw new AppError('Flag is required', 400);
    }
    
    console.log('🚩 Flag submission for user:', req.user.id, 'Flag:', flag);
    
    // Get user's progress
    const progress = await Progress.findOne({ userId: req.user.id });
    
    if (!progress) {
      throw new AppError('User progress not found', 404);
    }
    
    // Check real-time time remaining
    const now = new Date();
    const startTime = new Date(progress.startTime);
    const totalTimeLimit = progress.totalTimeLimit || 3600;
    const elapsedSeconds = Math.floor((now - startTime) / 1000);
    const actualTimeRemaining = Math.max(totalTimeLimit - elapsedSeconds, 0);
    
    // Check if time expired
    if (actualTimeRemaining <= 0) {
      throw new AppError('Time has expired', 400);
    }
    
    // Update time remaining
    progress.timeRemaining = actualTimeRemaining;
    
    // Get current challenge
    const challenge = await Challenge.findOne({ 
      levelNumber: progress.currentLevel,
      enabled: true
    });
    
    if (!challenge) {
      throw new AppError('Challenge not found', 404);
    }
    
    const currentLevel = progress.currentLevel.toString();
    
    // FIXED: Properly track flag attempts and counts
    // Initialize arrays if they don't exist
    if (!progress.flagsAttempted.has(currentLevel)) {
      progress.flagsAttempted.set(currentLevel, []);
    }
    
    // Add the flag attempt with timestamp and correctness
    const flagAttempt = {
      flag,
      timestamp: new Date(),
      correct: flag.trim() === challenge.flag.trim()
    };
    
    progress.flagsAttempted.get(currentLevel).push(flagAttempt);
    
    // Update attempt count
    const currentAttempts = progress.attemptCounts.get(currentLevel) || 0;
    const newAttemptCount = currentAttempts + 1;
    progress.attemptCounts.set(currentLevel, newAttemptCount);
    
    console.log('📊 Updated attempts for level', currentLevel, ':', newAttemptCount);
    
    // Check if flag is correct
    const isCorrect = flag.trim() === challenge.flag.trim();
    
    if (isCorrect) {
      console.log('✅ Correct flag submitted!');
      
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
          timeRemaining: actualTimeRemaining,
          attempts: newAttemptCount
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
          timeRemaining: actualTimeRemaining,
          attempts: newAttemptCount
        });
      }
    } else {
      console.log('❌ Incorrect flag submitted. Attempts:', newAttemptCount);
      
      // Wrong flag - save the progress with updated attempt count
      await progress.save();
      
      return res.status(200).json({
        status: 'success',
        message: 'Incorrect flag. Try again!',
        correct: false,
        attempts: newAttemptCount,
        timeRemaining: actualTimeRemaining
      });
    }
  } catch (error) {
    console.error('❌ Flag submission error:', error);
    next(error);
  }
};

// Get hint for current challenge
exports.getHint = async (req, res, next) => {
  try {
    // Get user's progress
    const progress = await Progress.findOne({ userId: req.user.id });
    
    if (!progress) {
      throw new AppError('User progress not found', 404);
    }
    
    // Check real-time time remaining
    const now = new Date();
    const startTime = new Date(progress.startTime);
    const totalTimeLimit = progress.totalTimeLimit || 3600;
    const elapsedSeconds = Math.floor((now - startTime) / 1000);
    const actualTimeRemaining = Math.max(totalTimeLimit - elapsedSeconds, 0);
    
    // Check if time expired
    if (actualTimeRemaining <= 0) {
      throw new AppError('Time has expired', 400);
    }
    
    // Update time remaining
    progress.timeRemaining = actualTimeRemaining;
    
    // Get current challenge
    const challenge = await Challenge.findOne({ 
      levelNumber: progress.currentLevel,
      enabled: true
    });
    
    if (!challenge) {
      throw new AppError('Challenge not found', 404);
    }
    
    const currentLevel = progress.currentLevel.toString();
    
    // Mark hint as used
    progress.hintsUsed.set(currentLevel, true);
    await progress.save();
    
    res.status(200).json({
      status: 'success',
      hint: challenge.hint,
      timeRemaining: actualTimeRemaining
    });
  } catch (error) {
    next(error);
  }
};