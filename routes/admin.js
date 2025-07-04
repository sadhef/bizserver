const express = require('express');
const User = require('../models/User');
const Challenge = require('../models/Challenge');
const Config = require('../models/Config');
const { authenticateAdmin } = require('../middleware/auth');

const router = express.Router();

// Get all users for admin dashboard
router.get('/users', authenticateAdmin, async (req, res) => {
  try {
    const { status, search, page = 1, limit = 10 } = req.query;
    
    let query = { isAdmin: false };
    
    // Filter by approval status
    if (status === 'approved') {
      query.isApproved = true;
    } else if (status === 'pending') {
      query.isApproved = false;
    }
    
    // Search by username or email
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await User.countDocuments(query);
    
    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ 
      error: 'Server error fetching users',
      code: 'GET_USERS_ERROR'
    });
  }
});

// Approve user
router.put('/users/:userId/approve', authenticateAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }
    
    if (user.isAdmin) {
      return res.status(400).json({ 
        error: 'Cannot modify admin user',
        code: 'CANNOT_MODIFY_ADMIN'
      });
    }
    
    user.isApproved = true;
    await user.save();
    
    res.json({ 
      message: 'User approved successfully',
      user: user.toJSON()
    });
  } catch (error) {
    console.error('Approve user error:', error);
    res.status(500).json({ 
      error: 'Server error approving user',
      code: 'APPROVE_USER_ERROR'
    });
  }
});

// Disapprove user
router.put('/users/:userId/disapprove', authenticateAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }
    
    if (user.isAdmin) {
      return res.status(400).json({ 
        error: 'Cannot modify admin user',
        code: 'CANNOT_MODIFY_ADMIN'
      });
    }
    
    user.isApproved = false;
    user.isActive = false; // Also deactivate if they were in a challenge
    await user.save();
    
    res.json({ 
      message: 'User approval revoked successfully',
      user: user.toJSON()
    });
  } catch (error) {
    console.error('Disapprove user error:', error);
    res.status(500).json({ 
      error: 'Server error revoking user approval',
      code: 'DISAPPROVE_USER_ERROR'
    });
  }
});

// Delete user
router.delete('/users/:userId', authenticateAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found',code: 'USER_NOT_FOUND'
      });
    }
    
    if (user.isAdmin) {
      return res.status(400).json({ 
        error: 'Cannot delete admin user',
        code: 'CANNOT_DELETE_ADMIN'
      });
    }
    
    await User.findByIdAndDelete(userId);
    
    res.json({ 
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ 
      error: 'Server error deleting user',
      code: 'DELETE_USER_ERROR'
    });
  }
});

// Reset user progress - ENHANCED with better tracking
router.put('/users/:userId/reset', authenticateAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.user._id;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }
    
    if (user.isAdmin) {
      return res.status(400).json({ 
        error: 'Cannot reset admin user',
        code: 'CANNOT_RESET_ADMIN'
      });
    }

    // Store previous state for logging
    const previousState = {
      currentLevel: user.currentLevel,
      completedLevels: [...user.completedLevels],
      totalAttempts: user.totalAttempts,
      isActive: user.isActive,
      challengeStartTime: user.challengeStartTime,
      challengeEndTime: user.challengeEndTime,
      challengeCompletionTime: user.challengeCompletionTime
    };

    // Reset user progress using the new method
    user.resetChallengeProgress(adminId);
    await user.save();

    console.log('User progress reset by admin:', {
      adminId,
      userId,
      username: user.username,
      previousState,
      resetCount: user.resetCount,
      resetTime: user.lastResetTime
    });
    
    res.json({ 
      message: 'User progress reset successfully',
      user: user.toJSON(),
      resetInfo: {
        resetCount: user.resetCount,
        lastResetTime: user.lastResetTime,
        resetBy: adminId,
        previousState
      }
    });
  } catch (error) {
    console.error('Reset user error:', error);
    res.status(500).json({ 
      error: 'Server error resetting user progress',
      code: 'RESET_USER_ERROR'
    });
  }
});

// NEW: Get user reset history
router.get('/users/:userId/reset-history', authenticateAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId)
      .populate('lastResetBy', 'username email')
      .select('resetCount lastResetTime lastResetBy challengeStartTime challengeCompletionTime');
    
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }
    
    res.json({
      resetHistory: {
        resetCount: user.resetCount,
        lastResetTime: user.lastResetTime,
        lastResetBy: user.lastResetBy,
        hasEverStarted: !!user.challengeStartTime,
        hasCompleted: !!user.challengeCompletionTime
      }
    });
  } catch (error) {
    console.error('Get reset history error:', error);
    res.status(500).json({ 
      error: 'Server error fetching reset history',
      code: 'GET_RESET_HISTORY_ERROR'
    });
  }
});

// NEW: Force end challenge for a user
router.put('/users/:userId/force-end', authenticateAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason = 'Ended by admin' } = req.body;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }
    
    if (!user.isActive) {
      return res.status(400).json({ 
        error: 'User challenge is not currently active',
        code: 'CHALLENGE_NOT_ACTIVE'
      });
    }

    // Force end the challenge
    user.isActive = false;
    user.challengeEndTime = new Date(); // Set end time to now
    
    // Add a submission record for tracking
    user.submissions.push({
      level: user.currentLevel,
      flag: `[ADMIN_FORCE_END: ${reason}]`,
      timestamp: new Date(),
      isCorrect: false
    });

    await user.save();

    console.log('Challenge force-ended by admin:', {
      adminId: req.user._id,
      userId,
      username: user.username,
      reason,
      endTime: user.challengeEndTime
    });
    
    res.json({ 
      message: 'Challenge ended successfully',
      user: user.toJSON(),
      endReason: reason,
      endTime: user.challengeEndTime
    });
  } catch (error) {
    console.error('Force end challenge error:', error);
    res.status(500).json({ 
      error: 'Server error ending challenge',
      code: 'FORCE_END_ERROR'
    });
  }
});

// Get challenge configuration
router.get('/config', authenticateAdmin, async (req, res) => {
  try {
    const config = await Config.getConfig();
    res.json(config);
  } catch (error) {
    console.error('Get config error:', error);
    res.status(500).json({ 
      error: 'Server error fetching configuration',
      code: 'GET_CONFIG_ERROR'
    });
  }
});

// Update challenge configuration
router.put('/config', authenticateAdmin, async (req, res) => {
  try {
    const updates = req.body;
    
    // Validate updates
    if (updates.totalTimeLimit && (updates.totalTimeLimit < 1 || updates.totalTimeLimit > 1440)) {
      return res.status(400).json({ 
        error: 'Time limit must be between 1 and 1440 minutes',
        code: 'INVALID_TIME_LIMIT'
      });
    }
    
    if (updates.maxLevels && (updates.maxLevels < 1 || updates.maxLevels > 10)) {
      return res.status(400).json({ 
        error: 'Max levels must be between 1 and 10',
        code: 'INVALID_MAX_LEVELS'
      });
    }
    
    const config = await Config.updateConfig(updates);
    
    res.json({ 
      message: 'Configuration updated successfully',
      config
    });
  } catch (error) {
    console.error('Update config error:', error);
    res.status(500).json({ 
      error: 'Server error updating configuration',
      code: 'UPDATE_CONFIG_ERROR'
    });
  }
});

// Get all challenges
router.get('/challenges', authenticateAdmin, async (req, res) => {
  try {
    const challenges = await Challenge.find().sort({ level: 1 });
    res.json(challenges);
  } catch (error) {
    console.error('Get challenges error:', error);
    res.status(500).json({ 
      error: 'Server error fetching challenges',
      code: 'GET_CHALLENGES_ERROR'
    });
  }
});

// Create new challenge
router.post('/challenges', authenticateAdmin, async (req, res) => {
  try {
    const { level, title, description, hint, flag, difficulty, category, points } = req.body;
    
    // Validation
    if (!level || !title || !description || !flag) {
      return res.status(400).json({ 
        error: 'Level, title, description, and flag are required',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }
    
    if (level < 1) {
      return res.status(400).json({ 
        error: 'Level must be greater than 0',
        code: 'INVALID_LEVEL'
      });
    }
    
    // Check if challenge already exists for this level
    const existingChallenge = await Challenge.findOne({ level });
    if (existingChallenge) {
      return res.status(400).json({ 
        error: 'Challenge for this level already exists',
        code: 'LEVEL_EXISTS'
      });
    }
    
    const challenge = new Challenge({
      level,
      title: title.trim(),
      description: description.trim(),
      hint: hint?.trim(),
      flag: flag.trim(),
      difficulty: difficulty || 'Medium',
      category: category || 'Web',
      points: points || 100
    });
    
    await challenge.save();
    
    res.status(201).json({ 
      message: 'Challenge created successfully',
      challenge
    });
  } catch (error) {
    console.error('Create challenge error:', error);
    res.status(500).json({ 
      error: 'Server error creating challenge',
      code: 'CREATE_CHALLENGE_ERROR'
    });
  }
});

// Update challenge
router.put('/challenges/:challengeId', authenticateAdmin, async (req, res) => {
  try {
    const { challengeId } = req.params;
    const updates = req.body;
    
    // Remove fields that shouldn't be updated this way
    delete updates._id;
    delete updates.createdAt;
    delete updates.updatedAt;
    delete updates.solveCount;
    
    const challenge = await Challenge.findByIdAndUpdate(
      challengeId,
      updates,
      { new: true, runValidators: true }
    );
    
    if (!challenge) {
      return res.status(404).json({ 
        error: 'Challenge not found',
        code: 'CHALLENGE_NOT_FOUND'
      });
    }
    
    res.json({ 
      message: 'Challenge updated successfully',
      challenge
    });
  } catch (error) {
    console.error('Update challenge error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({ 
        error: 'Challenge level already exists',
        code: 'DUPLICATE_LEVEL'
      });
    }
    
    res.status(500).json({ 
      error: 'Server error updating challenge',
      code: 'UPDATE_CHALLENGE_ERROR'
    });
  }
});

// Delete challenge
router.delete('/challenges/:challengeId', authenticateAdmin, async (req, res) => {
  try {
    const { challengeId } = req.params;
    
    const challenge = await Challenge.findByIdAndDelete(challengeId);
    
    if (!challenge) {
      return res.status(404).json({ 
        error: 'Challenge not found',
        code: 'CHALLENGE_NOT_FOUND'
      });
    }
    
    res.json({ 
      message: 'Challenge deleted successfully'
    });
  } catch (error) {
    console.error('Delete challenge error:', error);
    res.status(500).json({ 
      error: 'Server error deleting challenge',
      code: 'DELETE_CHALLENGE_ERROR'
    });
  }
});

// Preview challenge (for admin to test)
router.get('/challenges/:challengeId/preview', authenticateAdmin, async (req, res) => {
  try {
    const { challengeId } = req.params;
    
    const challenge = await Challenge.findById(challengeId);
    
    if (!challenge) {
      return res.status(404).json({ 
        error: 'Challenge not found',
        code: 'CHALLENGE_NOT_FOUND'
      });
    }
    
    res.json({
      challenge: challenge.getPublicData(),
      adminNote: 'This is a preview. The flag is hidden from regular users.',
      fullChallenge: challenge // Admin can see everything including flag
    });
  } catch (error) {
    console.error('Preview challenge error:', error);
    res.status(500).json({ 
      error: 'Server error previewing challenge',
      code: 'PREVIEW_CHALLENGE_ERROR'
    });
  }
});

// Real-time monitoring - ENHANCED with reset info
router.get('/monitoring', authenticateAdmin, async (req, res) => {
  try {
    const users = await User.find({ 
      isAdmin: false, 
      isApproved: true 
    })
    .populate('lastResetBy', 'username')
    .select('-password');
    
    const monitoring = users.map(user => {
      const timeRemaining = user.getTimeRemaining();
      const challengeSummary = user.getChallengeSummary();
      
      return {
        id: user._id,
        username: user.username,
        email: user.email,
        currentLevel: user.currentLevel,
        completedLevels: user.completedLevels,
        totalAttempts: user.totalAttempts,
        timeRemaining,
        isActive: user.isActive,
        challengeStartTime: user.challengeStartTime,
        challengeEndTime: user.challengeEndTime,
        challengeCompletionTime: user.challengeCompletionTime,
        lastActivity: user.lastActivity,
        resetCount: user.resetCount,
        lastResetTime: user.lastResetTime,
        lastResetBy: user.lastResetBy,
        challengeSummary,
        canRestart: !challengeSummary.hasStarted || (!challengeSummary.isCompleted && !challengeSummary.isExpired),
        submissions: user.submissions.map(sub => ({
          level: sub.level,
          timestamp: sub.timestamp,
          isCorrect: sub.isCorrect
        }))
      };
    });
    
    res.json(monitoring);
  } catch (error) {
    console.error('Monitoring error:', error);
    res.status(500).json({ 
      error: 'Server error fetching monitoring data',
      code: 'MONITORING_ERROR'
    });
  }
});

// Get detailed user statistics - ENHANCED
router.get('/stats', authenticateAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ isAdmin: false });
    const approvedUsers = await User.countDocuments({ isAdmin: false, isApproved: true });
    const activeUsers = await User.countDocuments({ isAdmin: false, isActive: true });
    const pendingUsers = await User.countDocuments({ isAdmin: false, isApproved: false });
    
    // NEW: Users who have completed challenges
    const completedUsers = await User.countDocuments({ 
      isAdmin: false, 
      challengeCompletionTime: { $exists: true } 
    });
    
    // NEW: Users who had time expire
    const expiredUsers = await User.countDocuments({ 
      isAdmin: false, 
      challengeStartTime: { $exists: true },
      isActive: false,
      challengeCompletionTime: { $exists: false }
    });
    
    // NEW: Users who never started
    const neverStartedUsers = await User.countDocuments({ 
      isAdmin: false, 
      isApproved: true,
      challengeStartTime: { $exists: false }
    });

    // NEW: Reset statistics
    const resetStats = await User.aggregate([
      { $match: { isAdmin: false, resetCount: { $gt: 0 } } },
      { 
        $group: { 
          _id: null, 
          totalResets: { $sum: '$resetCount' },
          usersReset: { $sum: 1 },
          avgResetsPerUser: { $avg: '$resetCount' }
        } 
      }
    ]);
    
    const totalChallenges = await Challenge.countDocuments();
    const activeChallenges = await Challenge.countDocuments({ isActive: true });
    
    // Level completion stats
    const levelStats = await User.aggregate([
      { $match: { isAdmin: false, isApproved: true } },
      { $unwind: { path: '$completedLevels', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$completedLevels', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    
    // Current level distribution
    const currentLevelStats = await User.aggregate([
      { $match: { isAdmin: false, isApproved: true } },
      { $group: { _id: '$currentLevel', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    
    // Recent registrations (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentRegistrations = await User.countDocuments({
      isAdmin: false,
      createdAt: { $gte: sevenDaysAgo }
    });
    
    res.json({
      userStats: {
        total: totalUsers,
        approved: approvedUsers,
        pending: pendingUsers,
        active: activeUsers,
        completed: completedUsers,
        expired: expiredUsers,
        neverStarted: neverStartedUsers,
        recentRegistrations
      },
      challengeStats: {
        total: totalChallenges,
        active: activeChallenges
      },
      resetStats: resetStats[0] || { totalResets: 0, usersReset: 0, avgResetsPerUser: 0 },
      levelStats,
      currentLevelStats
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ 
      error: 'Server error fetching statistics',
      code: 'GET_STATS_ERROR'
    });
  }
});

// Bulk approve users
router.put('/users/bulk-approve', authenticateAdmin, async (req, res) => {
  try {
    const { userIds } = req.body;
    
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ 
        error: 'User IDs array is required',
        code: 'INVALID_USER_IDS'
      });
    }
    
    const result = await User.updateMany(
      { 
        _id: { $in: userIds },
        isAdmin: false
      },
      { isApproved: true }
    );
    
    res.json({ 
      message: `${result.modifiedCount} users approved successfully`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Bulk approve error:', error);
    res.status(500).json({ 
      error: 'Server error during bulk approval',
      code: 'BULK_APPROVE_ERROR'
    });
  }
});

// NEW: Bulk reset users
router.put('/users/bulk-reset', authenticateAdmin, async (req, res) => {
  try {
    const { userIds } = req.body;
    const adminId = req.user._id;
    
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ 
        error: 'User IDs array is required',
        code: 'INVALID_USER_IDS'
      });
    }
    
    const users = await User.find({ 
      _id: { $in: userIds },
      isAdmin: false
    });
    
    let resetCount = 0;
    for (const user of users) {
      user.resetChallengeProgress(adminId);
      await user.save();
      resetCount++;
    }
    
    res.json({ 
      message: `${resetCount} users reset successfully`,
      resetCount
    });
  } catch (error) {
    console.error('Bulk reset error:', error);
    res.status(500).json({ 
      error: 'Server error during bulk reset',
      code: 'BULK_RESET_ERROR'
    });
  }
});

// Export user data (for admin reports) - ENHANCED
router.get('/export/users', authenticateAdmin, async (req, res) => {
  try {
    const { format = 'json' } = req.query;
    
    const users = await User.find({ isAdmin: false })
      .populate('lastResetBy', 'username')
      .select('-password')
      .sort({ createdAt: -1 });
    
    if (format === 'csv') {
      // Enhanced CSV export with new fields
      let csv = 'Username,Email,Approved,Level,Completed Levels,Total Attempts,Started,Completed,Expired,Reset Count,Last Reset,Created At\n';
      users.forEach(user => {
        const summary = user.getChallengeSummary();
        csv += `${user.username},${user.email},${user.isApproved},${user.currentLevel},"${user.completedLevels.join(',')}",${user.totalAttempts},${summary.hasStarted},${summary.isCompleted},${summary.isExpired},${user.resetCount},${user.lastResetTime || ''},${user.createdAt}\n`;
      });
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=users.csv');
      res.send(csv);
    } else {
      // Enhanced JSON export
      const enhancedUsers = users.map(user => ({
        ...user.toJSON(),
        challengeSummary: user.getChallengeSummary()
      }));
      res.json(enhancedUsers);
    }
  } catch (error) {
    console.error('Export users error:', error);
    res.status(500).json({ 
      error: 'Server error exporting user data',
      code: 'EXPORT_USERS_ERROR'
    });
  }
});

module.exports = router;