const Progress = require('../models/Progress');
const Challenge = require('../models/Challenge');
const { AppError } = require('../../utils/errorHandler');

// Get user progress
exports.getUserProgress = async (req, res, next) => {
  try {
    const progress = await Progress.find({ userId: req.user.id })
      .populate('challengeId', 'title difficulty points')
      .sort({ updatedAt: -1 });
    
    res.status(200).json({
      status: 'success',
      results: progress.length,
      progress
    });
  } catch (error) {
    next(error);
  }
};

// Start or update challenge progress
exports.createOrUpdateProgress = async (req, res, next) => {
  try {
    const { challengeId, status, submission } = req.body;

    // Verify challenge exists and is active
    const challenge = await Challenge.findById(challengeId);
    if (!challenge) {
      throw new AppError('Challenge not found', 404);
    }

    if (!challenge.isActive) {
      throw new AppError('Challenge is not available', 403);
    }

    // Find existing progress or create new
    let progress = await Progress.findOne({
      userId: req.user.id,
      challengeId
    });

    if (progress) {
      // Update existing progress
      progress.status = status || progress.status;
      progress.submission = submission || progress.submission;
      progress.updatedAt = new Date();
      
      if (status === 'completed') {
        progress.completedAt = new Date();
        // Calculate score (simplified - you can implement your scoring logic)
        progress.score = challenge.points;
      }
    } else {
      // Create new progress
      progress = new Progress({
        userId: req.user.id,
        challengeId,
        status: status || 'in_progress',
        startedAt: new Date(),
        submission: submission || {}
      });
    }

    await progress.save();

    // Update challenge completion count
    if (status === 'completed') {
      await Challenge.findByIdAndUpdate(challengeId, {
        $inc: { completionCount: 1 }
      });
    }
    
    res.status(200).json({
      status: 'success',
      message: 'Progress updated successfully',
      progress
    });
  } catch (error) {
    next(error);
  }
};

// Update progress
exports.updateProgress = async (req, res, next) => {
  try {
    const progress = await Progress.findOneAndUpdate(
      { userId: req.user.id, challengeId: req.params.challengeId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!progress) {
      throw new AppError('Progress not found', 404);
    }
    
    res.status(200).json({
      status: 'success',
      message: 'Progress updated successfully',
      progress
    });
  } catch (error) {
    next(error);
  }
};

// Get progress statistics
exports.getProgressStats = async (req, res, next) => {
  try {
    const stats = await Progress.aggregate([
      {
        $match: { userId: req.user.id }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalScore: { $sum: '$score' }
        }
      }
    ]);

    const totalProgress = await Progress.countDocuments({ userId: req.user.id });
    
    res.status(200).json({
      status: 'success',
      stats: {
        total: totalProgress,
        breakdown: stats
      }
    });
  } catch (error) {
    next(error);
  }
};