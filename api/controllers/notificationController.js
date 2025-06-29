const admin = require('../config/firebase-admin');
const NotificationToken = require('../models/NotificationToken');
const User = require('../models/User');
const { AppError } = require('../../utils/errorHandler');

/**
 * Save FCM token for a user
 * @route POST /api/notifications/token
 * @access Private
 */
exports.saveToken = async (req, res, next) => {
  try {
    const { token, platform = 'web' } = req.body;
    const userId = req.user.id;

    if (!token) {
      throw new AppError('FCM token is required', 400);
    }

    // Get user agent and IP for tracking
    const userAgent = req.headers['user-agent'] || '';
    const ipAddress = req.ip || req.connection.remoteAddress || '';

    // Validate token with Firebase (dry run)
    try {
      await admin.messaging().send({
        token,
        notification: {
          title: 'Test',
          body: 'Test'
        }
      }, true); // dry run
    } catch (error) {
      if (error.code === 'messaging/invalid-registration-token') {
        throw new AppError('Invalid FCM token', 400);
      }
    }

    // Deactivate any existing tokens for this user on the same platform
    await NotificationToken.deactivateUserTokens(userId, platform);

    // Check if token already exists
    let existingToken = await NotificationToken.findOne({ token });

    if (existingToken) {
      // Update existing token
      existingToken.userId = userId;
      existingToken.platform = platform;
      existingToken.isActive = true;
      existingToken.lastUsed = new Date();
      existingToken.userAgent = userAgent;
      existingToken.ipAddress = ipAddress;
      await existingToken.save();
    } else {
      // Create new token
      await NotificationToken.create({
        userId,
        token,
        platform,
        isActive: true,
        userAgent,
        ipAddress
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Token saved successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove FCM token
 * @route DELETE /api/notifications/token
 * @access Private
 */
exports.removeToken = async (req, res, next) => {
  try {
    const { token } = req.body;
    const userId = req.user.id;

    if (!token) {
      throw new AppError('FCM token is required', 400);
    }

    await NotificationToken.findOneAndUpdate(
      { token, userId },
      { isActive: false }
    );

    res.status(200).json({
      status: 'success',
      message: 'Token removed successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send push notification with advanced features
 * @route POST /api/notifications/send
 * @access Admin
 */
exports.sendNotification = async (req, res, next) => {
  try {
    const { 
      title,
        body,
        targetType, 
      targetUsers, 
      role,
      imageUrl,
      actionUrl,
      priority = 'normal',
      ttl = 86400,
      silent = false
    } = req.body;

    if (!title || !body) {
      throw new AppError('Title and body are required', 400);
    }

    let tokens = [];
    let targetUserCount = 0;

    // Get tokens based on target type
    switch (targetType) {
      case 'all':
        const allTokens = await NotificationToken.find({ isActive: true })
          .populate('userId', 'name email');
        tokens = allTokens.map(t => t.token);
        targetUserCount = allTokens.length;
        break;

      case 'role':
        const roleFilter = 
          role === 'admin' ? { isAdmin: true } :
          role === 'cloud' ? { isCloud: true } :
          { isAdmin: false, isCloud: false };
        
        const usersByRole = await User.find(roleFilter);
        const roleUserIds = usersByRole.map(u => u._id);
        const roleTokens = await NotificationToken.find({
          userId: { $in: roleUserIds },
          isActive: true
        });
        tokens = roleTokens.map(t => t.token);
        targetUserCount = roleTokens.length;
        break;

      case 'specific':
        if (!targetUsers || !Array.isArray(targetUsers)) {
          throw new AppError('Target users array is required for specific targeting', 400);
        }
        const specificTokens = await NotificationToken.find({
          userId: { $in: targetUsers },
          isActive: true
        });
        tokens = specificTokens.map(t => t.token);
        targetUserCount = specificTokens.length;
        break;

      default:
        throw new AppError('Invalid target type', 400);
    }

    if (tokens.length === 0) {
      return res.status(200).json({
        status: 'success',
        message: 'No active devices found for the selected target',
        sentCount: 0,
        targetUserCount: 0
      });
    }

    // Prepare enhanced notification payload
    const baseMessage = {
      notification: {
        title,
        body,
        ...(imageUrl && { imageUrl })
      },
      data: {
        clickAction: actionUrl || '/',
        timestamp: Date.now().toString(),
        priority: priority
      },
      webpush: {
        headers: {
          'TTL': ttl.toString(),
          'Urgency': priority === 'high' ? 'high' : 'normal'
        },
        notification: {
          title,
          body,
          icon: '/biztras.png',
          badge: '/biztras.png',
          requireInteraction: priority === 'high',
          silent: silent,
          ...(imageUrl && { image: imageUrl }),
          actions: actionUrl ? [
            {
              action: 'open',
              title: 'Open App'
            },
            {
              action: 'dismiss',
              title: 'Dismiss'
            }
          ] : undefined,
          data: {
            url: actionUrl || '/'
          }
        }
      }
    };

    // Send notifications in batches
    const batchSize = 500;
    let sentCount = 0;
    let failedCount = 0;
    const failedTokens = [];

    for (let i = 0; i < tokens.length; i += batchSize) {
      const batch = tokens.slice(i, i + batchSize);
      
      try {
        const response = await admin.messaging().sendMulticast({
          ...baseMessage,
          tokens: batch
        });

        sentCount += response.successCount;
        failedCount += response.failureCount;

        // Handle failed tokens
        if (response.failureCount > 0) {
          response.responses.forEach((resp, idx) => {
            if (!resp.success) {
              const failedToken = batch[idx];
              failedTokens.push({
                token: failedToken,
                error: resp.error?.message
              });
              
              // Deactivate invalid tokens
              if (resp.error?.code === 'messaging/invalid-registration-token' ||
                  resp.error?.code === 'messaging/registration-token-not-registered') {
                NotificationToken.findOneAndUpdate(
                  { token: failedToken },
                  { isActive: false }
                ).exec();
              }
            }
          });
        }
      } catch (error) {
        console.error('Error sending notification batch:', error);
        failedCount += batch.length;
      }
    }

    // Log notification for analytics
    console.log(`Notification sent: ${title} | Sent: ${sentCount} | Failed: ${failedCount}`);

    res.status(200).json({
      status: 'success',
      message: 'Notification processing completed',
      sentCount,
      failedCount,
      totalTokens: tokens.length,
      targetUserCount,
      failedTokens: failedTokens.slice(0, 10) // Limit for response size
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get detailed notification statistics
 * @route GET /api/notifications/stats
 * @access Admin
 */
exports.getNotificationStats = async (req, res, next) => {
  try {
    // Basic counts
    const totalTokens = await NotificationToken.countDocuments({ isActive: true });
    const totalUsers = await User.countDocuments();
    const usersWithNotifications = await NotificationToken.distinct('userId', { isActive: true });

    // Platform breakdown
    const platformStats = await NotificationToken.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$platform', count: { $sum: 1 } } }
    ]);

    // Role-based breakdown
    const adminUsers = await User.countDocuments({ isAdmin: true });
    const cloudUsers = await User.countDocuments({ isCloud: true });
    const regularUsers = await User.countDocuments({ isAdmin: false, isCloud: false });

    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentTokens = await NotificationToken.countDocuments({
      isActive: true,
      lastUsed: { $gte: sevenDaysAgo }
    });

    res.status(200).json({
      status: 'success',
      totalTokens,
      totalUsers,
      usersWithNotifications: usersWithNotifications.length,
      notificationCoverage: totalUsers > 0 ? (usersWithNotifications.length / totalUsers * 100).toFixed(1) : 0,
      platformStats: platformStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {}),
      userStats: {
        admin: adminUsers,
        cloud: cloudUsers,
        regular: regularUsers
      },
      recentActivity: {
        activeInLast7Days: recentTokens,
        percentage: totalTokens > 0 ? (recentTokens / totalTokens * 100).toFixed(1) : 0
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Test notification (send to current admin)
 * @route POST /api/notifications/test
 * @access Admin
 */
exports.testNotification = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Get admin's tokens
    const userTokens = await NotificationToken.find({
      userId,
      isActive: true
    });

    if (userTokens.length === 0) {
      throw new AppError('No active notification tokens found for your account', 404);
    }

    const tokens = userTokens.map(t => t.token);
    
    const message = {
      notification: {
        title: 'Test Notification',
        body: 'This is a test notification from BizTras admin panel. If you can see this, push notifications are working correctly!'
      },
      webpush: {
        notification: {
          title: 'Test Notification',
          body: 'This is a test notification from BizTras admin panel. If you can see this, push notifications are working correctly!',
          icon: '/biztras.png',
          badge: '/biztras.png',
          requireInteraction: true
        }
      },
      tokens
    };

    const response = await admin.messaging().sendMulticast(message);

    res.status(200).json({
      status: 'success',
      message: 'Test notification sent',
      sentCount: response.successCount,
      failedCount: response.failureCount
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Clean up old inactive tokens
 * @route POST /api/notifications/cleanup
 * @access Admin
 */
exports.cleanupTokens = async (req, res, next) => {
  try {
    const { daysOld = 30 } = req.body;
    
    const result = await NotificationToken.cleanupOldTokens(daysOld);
    
    res.status(200).json({
      status: 'success',
      message: `Cleaned up ${result.deletedCount} old inactive tokens`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    next(error);
  }
};