// api/controllers/notificationController.js
const admin = require('../config/firebase-admin');
const NotificationToken = require('../models/NotificationToken');
const User = require('../models/User');
const { AppError } = require('../../utils/errorHandler');

// Save FCM token
const saveToken = async (req, res, next) => {
  try {
    const { token, platform = 'web' } = req.body;
    const userId = req.user.id;

    if (!token) {
      throw new AppError('FCM token is required', 400);
    }

    // Validate token with Firebase (dry run)
    try {
      await admin.messaging().send({
        token,
        data: { test: 'validation' }
      }, true); // dry run
      console.log('✅ FCM token validated successfully');
    } catch (error) {
      if (error.code === 'messaging/invalid-registration-token') {
        throw new AppError('Invalid FCM token', 400);
      }
      console.warn('⚠️ Token validation skipped:', error.message);
    }

    // Get user agent and IP for tracking
    const userAgent = req.headers['user-agent'] || '';
    const ipAddress = req.ip || req.connection.remoteAddress || '';

    // Deactivate existing tokens for this user/platform
    await NotificationToken.updateMany(
      { userId, platform, isActive: true },
      { 
        isActive: false,
        lastUsed: new Date()
      }
    );

    // Save new token
    let existingToken = await NotificationToken.findOne({ token });
    
    if (existingToken) {
      existingToken.userId = userId;
      existingToken.platform = platform;
      existingToken.isActive = true;
      existingToken.lastUsed = new Date();
      existingToken.userAgent = userAgent;
      existingToken.ipAddress = ipAddress;
      await existingToken.save();
      console.log('🔄 Updated existing token for user:', userId);
    } else {
      await NotificationToken.create({
        userId,
        token,
        platform,
        isActive: true,
        userAgent,
        ipAddress,
        lastUsed: new Date()
      });
      console.log('💾 Created new token for user:', userId);
    }

    res.status(200).json({
      status: 'success',
      message: 'Token saved successfully'
    });

  } catch (error) {
    console.error('❌ Error saving token:', error);
    next(error);
  }
};

// Remove FCM token
const removeToken = async (req, res, next) => {
  try {
    const { token } = req.body;
    const userId = req.user.id;

    if (!token) {
      throw new AppError('FCM token is required', 400);
    }

    const result = await NotificationToken.findOneAndUpdate(
      { token, userId },
      { 
        isActive: false,
        lastUsed: new Date()
      }
    );

    if (result) {
      console.log('🗑️ Token deactivated for user:', userId);
    }

    res.status(200).json({
      status: 'success',
      message: 'Token removed successfully'
    });

  } catch (error) {
    console.error('❌ Error removing token:', error);
    next(error);
  }
};

// Send notification
const sendNotification = async (req, res, next) => {
  try {
    const { 
      title, 
      body, 
      targetType, 
      targetUsers, 
      role,
      imageUrl,
      actionUrl,
      priority = 'normal'
    } = req.body;

    if (!title || !body) {
      throw new AppError('Title and body are required', 400);
    }

    let tokens = [];
    let targetUserCount = 0;

    // Get tokens based on target type
    switch (targetType) {
      case 'all':
        const allTokens = await NotificationToken.find({ isActive: true });
        tokens = allTokens.map(t => t.token);
        targetUserCount = allTokens.length;
        console.log(`📢 Targeting all users: ${targetUserCount} devices`);
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
        console.log(`👥 Targeting ${role} users: ${targetUserCount} devices`);
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
        console.log(`🎯 Targeting specific users: ${targetUserCount} devices`);
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

    // Prepare message
    const message = {
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
        notification: {
          title,
          body,
          icon: '/biztras.png',
          badge: '/biztras.png',
          requireInteraction: priority === 'high',
          ...(imageUrl && { image: imageUrl }),
          actions: actionUrl ? [
            { action: 'open', title: 'Open App' },
            { action: 'dismiss', title: 'Dismiss' }
          ] : undefined,
          data: { url: actionUrl || '/' }
        }
      }
    };

    // Send notifications in batches
    const batchSize = 500;
    let sentCount = 0;
    let failedCount = 0;
    const failedTokens = [];

    console.log(`📤 Sending notifications to ${tokens.length} devices in batches of ${batchSize}`);

    for (let i = 0; i < tokens.length; i += batchSize) {
      const batch = tokens.slice(i, i + batchSize);
      
      try {
        const response = await admin.messaging().sendMulticast({
          ...message,
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
                token: failedToken.substring(0, 20) + '...',
                error: resp.error?.message
              });
              
              // Deactivate invalid tokens
              if (resp.error?.code === 'messaging/invalid-registration-token' ||
                  resp.error?.code === 'messaging/registration-token-not-registered') {
                NotificationToken.findOneAndUpdate(
                  { token: failedToken },
                  { isActive: false, lastUsed: new Date() }
                ).exec();
              }
            }
          });
        }

        console.log(`📊 Batch ${Math.floor(i/batchSize) + 1}: Sent ${response.successCount}, Failed ${response.failureCount}`);
      } catch (error) {
        console.error('❌ Error sending notification batch:', error);
        failedCount += batch.length;
      }
    }

    console.log(`🎉 Notification "${title}" completed: ✅ ${sentCount} sent, ❌ ${failedCount} failed`);

    res.status(200).json({
      status: 'success',
      message: 'Notification processing completed',
      sentCount,
      failedCount,
      totalTokens: tokens.length,
      targetUserCount,
      failedTokens: failedTokens.slice(0, 10) // Return first 10 failed tokens for debugging
    });

  } catch (error) {
    console.error('❌ Error sending notification:', error);
    next(error);
  }
};

// Send test notification
const testNotification = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const userTokens = await NotificationToken.find({
      userId,
      isActive: true
    });

    if (userTokens.length === 0) {
      throw new AppError('No active notification tokens found for your account', 404);
    }

    const tokens = userTokens.map(t => t.token);
    console.log(`🧪 Sending test notification to ${tokens.length} devices for user ${userId}`);
    
    const message = {
      notification: {
        title: '🧪 Test Notification',
        body: 'This is a test notification from BizTras admin panel. If you can see this, push notifications are working correctly!'
      },
      data: {
        test: 'true',
        timestamp: Date.now().toString()
      },
      webpush: {
        notification: {
          title: '🧪 Test Notification',
          body: 'This is a test notification from BizTras admin panel. If you can see this, push notifications are working correctly!',
          icon: '/biztras.png',
          badge: '/biztras.png',
          requireInteraction: true,
          actions: [
            { action: 'open', title: 'Open App' },
            { action: 'dismiss', title: 'Dismiss' }
          ],
          data: { url: '/' }
        }
      },
      tokens
    };

    const response = await admin.messaging().sendMulticast(message);

    console.log(`✅ Test notification sent: ${response.successCount} successful, ${response.failureCount} failed`);

    res.status(200).json({
      status: 'success',
      message: 'Test notification sent',
      sentCount: response.successCount,
      failedCount: response.failureCount
    });

  } catch (error) {
    console.error('❌ Error sending test notification:', error);
    next(error);
  }
};

// Get notification statistics
const getNotificationStats = async (req, res, next) => {
  try {
    const totalTokens = await NotificationToken.countDocuments({ isActive: true });
    const totalUsers = await User.countDocuments();
    const usersWithNotifications = await NotificationToken.distinct('userId', { isActive: true });

    const platformStats = await NotificationToken.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$platform', count: { $sum: 1 } } }
    ]);

    const adminUsers = await User.countDocuments({ isAdmin: true });
    const cloudUsers = await User.countDocuments({ isCloud: true });
    const regularUsers = await User.countDocuments({ isAdmin: false, isCloud: false });

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentTokens = await NotificationToken.countDocuments({
      isActive: true,
      lastUsed: { $gte: sevenDaysAgo }
    });

    // Get device statistics
    const deviceStats = await NotificationToken.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$deviceInfo.browser', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.status(200).json({
      status: 'success',
      totalTokens,
      totalUsers,
      usersWithNotifications: usersWithNotifications.length,
      notificationCoverage: totalUsers > 0 ? 
        (usersWithNotifications.length / totalUsers * 100).toFixed(1) : 0,
      platformStats: platformStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {}),
      deviceStats: deviceStats.reduce((acc, stat) => {
        acc[stat._id || 'Unknown'] = stat.count;
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
    console.error('❌ Error fetching notification stats:', error);
    next(error);
  }
};

module.exports = {
  saveToken,
  removeToken,
  sendNotification,
  testNotification,
  getNotificationStats
};