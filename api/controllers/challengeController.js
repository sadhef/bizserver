const Challenge = require('../models/Challenge');
const Progress = require('../models/Progress');
const { AppError } = require('../../utils/errorHandler');

// Get all challenges (for approved users)
exports.getAllChallenges = async (req, res, next) => {
  try {
    const challenges = await Challenge.find({ isActive: true })
      .select('-content.hints') // Don't send hints initially
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      status: 'success',
      results: challenges.length,
      challenges
    });
  } catch (error) {
    next(error);
  }
};

// Get challenge by ID
exports.getChallenge = async (req, res, next) => {
  try {
    const challenge = await Challenge.findById(req.params.id);
    
    if (!challenge) {
      throw new AppError('Challenge not found', 404);
    }

    if (!challenge.isActive && !req.user.isAdmin) {
      throw new AppError('Challenge is not available', 403);
    }
    
    res.status(200).json({
      status: 'success',
      challenge
    });
  } catch (error) {
    next(error);
  }
};

// Create challenge (admin only)
exports.createChallenge = async (req, res, next) => {
  try {
    const challengeData = {
      ...req.body,
      createdBy: req.user.id
    };

    const challenge = await Challenge.create(challengeData);
    
    res.status(201).json({
      status: 'success',
      message: 'Challenge created successfully',
      challenge
    });
  } catch (error) {
    next(error);
  }
};

// Update challenge (admin only)
exports.updateChallenge = async (req, res, next) => {
  try {
    const challenge = await Challenge.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!challenge) {
      throw new AppError('Challenge not found', 404);
    }
    
    res.status(200).json({
      status: 'success',
      message: 'Challenge updated successfully',
      challenge
    });
  } catch (error) {
    next(error);
  }
};

// Delete challenge (admin only)
exports.deleteChallenge = async (req, res, next) => {
  try {
    const challenge = await Challenge.findByIdAndDelete(req.params.id);

    if (!challenge) {
      throw new AppError('Challenge not found', 404);
    }

    // Also delete related progress
    await Progress.deleteMany({ challengeId: req.params.id });
    
    res.status(204).json({
      status: 'success',
      message: 'Challenge deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Get challenges for admin
exports.getAdminChallenges = async (req, res, next) => {
  try {
    const challenges = await Challenge.find({})
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      status: 'success',
      results: challenges.length,
      challenges
    });
  } catch (error) {
    next(error);
  }
};

// Get challenge statistics
exports.getChallengeStats = async (req, res, next) => {
  try {
    const totalChallenges = await Challenge.countDocuments();
    const activeChallenges = await Challenge.countDocuments({ isActive: true });
    const inactiveChallenges = totalChallenges - activeChallenges;

    res.status(200).json({
      status: 'success',
      stats: {
        total: totalChallenges,
        active: activeChallenges,
        inactive: inactiveChallenges
      }
    });
  } catch (error) {
    next(error);
  }
};