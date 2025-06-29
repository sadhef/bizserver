const webpush = require('web-push');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const PushNotification = require('../models/PushNotification');
const { AppError } = require('../../utils/errorHandler');

// Configure VAPID
webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL}`,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Subscribe to push notifications
exports.subscribe = async (req, res, next) => {
  try {
    const { endpoint, keys } = req.body;

    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return next(new AppError('Invalid subscription data', 400));
    }

    // Check if subscription already exists
    const existingSubscription = await Subscription.findOne({
      userId: req.user.id,
      endpoint
    });

    if (existingSubscription) {
      // Update existing subscription
      existingSubscription.keys = keys;
      existingSubscription.isActive = true;
      existingSubscription.userAgent = req.get('User-Agent');
      await existingSubscription.save();
    } else {
      // Create new subscription
      await Subscription.create({
        userId: req.user.id,
        endpoint,
        keys,
        userAgent: req.get('User-Agent')
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Subscription saved successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Send notification to all users (Admin only)
exports.sendToAll = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Validation failed', 400));
    }

    const { title, message, url = '/dashboard' } = req.body;

    // Get all active subscriptions
    const subscriptions = await Subscription.find({ isActive: true })
      .populate('userId', 'username isCloud isAdmin');

    if (subscriptions.length === 0) {
      return res.status(200).json({
        status: 'success',
        message: 'No active subscriptions found',
        data: { totalSent: 0, delivered: 0, failed: 0 }
      });
    }

    // Create notification record
    const notification = new PushNotification({
      title,
      message,
      url,
      targetType: 'all',
      sentBy: req.user.id,
      sentTo: subscriptions.map(sub => sub.userId._id),
      totalSent: subscriptions.length
    });

    const payload = JSON.stringify({
      title,
      body: message,
      icon: '/logo192.png',
      url,
      data: { url }
    });

    // Send notifications
    const deliveryPromises = subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(subscription, payload);
        
        notification.deliveryStatus.push({
          userId: subscription.userId._id,
          status: 'delivered',
          deliveredAt: new Date()
        });
        
        return { success: true };
      } catch (error) {
        // Mark subscription as inactive if endpoint is invalid
        if (error.statusCode === 410) {
          await Subscription.findByIdAndUpdate(subscription._id, { isActive: false });
        }
        
        notification.deliveryStatus.push({
          userId: subscription.userId._id,
          status: 'failed',
          error: error.message
        });
        
        return { success: false };
      }
    });

    const results = await Promise.all(deliveryPromises);
    const delivered = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    // Update notification with final counts
    notification.totalDelivered = delivered;
    notification.totalFailed = failed;
    await notification.save();

    res.status(200).json({
      status: 'success',
      message: 'Notification sent successfully',
      data: {
        notificationId: notification._id,
        totalSent: subscriptions.length,
        delivered,
        failed
      }
    });
  } catch (error) {
    next(error);
  }
};

// Send notification to cloud users only (Admin only)
exports.sendToCloudUsers = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Validation failed', 400));
    }

    const { title, message, url = '/cloud-dashboard' } = req.body;

    // Get cloud users with active subscriptions
    const cloudUsers = await User.find({ isCloud: true, isActive: true });
    const cloudUserIds = cloudUsers.map(user => user._id);

    const subscriptions = await Subscription.find({
      userId: { $in: cloudUserIds },
      isActive: true
    }).populate('userId');

    if (subscriptions.length === 0) {
      return res.status(200).json({
        status: 'success',
        message: 'No active cloud user subscriptions found',
        data: { totalSent: 0, delivered: 0, failed: 0 }
      });
    }

    // Create notification record
    const notification = new PushNotification({
      title,
      message,
      url,
      targetType: 'cloud_users',
      sentBy: req.user.id,
      sentTo: cloudUserIds,
      totalSent: subscriptions.length
    });

    const payload = JSON.stringify({
      title,
      body: message,
      icon: '/logo192.png',
      url,
      data: { url }
    });

    // Send notifications (same logic as sendToAll)
    const deliveryPromises = subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(subscription, payload);
        
        notification.deliveryStatus.push({
          userId: subscription.userId._id,
          status: 'delivered',
          deliveredAt: new Date()
        });
        
        return { success: true };
      } catch (error) {
        if (error.statusCode === 410) {
          await Subscription.findByIdAndUpdate(subscription._id, { isActive: false });
        }
        
        notification.deliveryStatus.push({
          userId: subscription.userId._id,
          status: 'failed',
          error: error.message
        });
        
        return { success: false };
      }
    });

    const results = await Promise.all(deliveryPromises);
    const delivered = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    notification.totalDelivered = delivered;
    notification.totalFailed = failed;
    await notification.save();

    res.status(200).json({
      status: 'success',
      message: 'Notification sent to cloud users successfully',
      data: {
        notificationId: notification._id,
        totalSent: subscriptions.length,
        delivered,
        failed
      }
    });
  } catch (error) {
    next(error);
  }
};

// Send notification to regular users only (Admin only)
exports.sendToRegularUsers = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Validation failed', 400));
    }

    const { title, message, url = '/challenges' } = req.body;

    // Get regular users (not admin, not cloud)
    const regularUsers = await User.find({ 
      isAdmin: false, 
      isCloud: false, 
      isActive: true 
    });
    const regularUserIds = regularUsers.map(user => user._id);

    const subscriptions = await Subscription.find({
      userId: { $in: regularUserIds },
      isActive: true
    }).populate('userId');

    if (subscriptions.length === 0) {
      return res.status(200).json({
        status: 'success',
        message: 'No active regular user subscriptions found',
        data: { totalSent: 0, delivered: 0, failed: 0 }
      });
    }

    // Create notification record
    const notification = new PushNotification({
      title,
      message,
      url,
      targetType: 'regular_users',
      sentBy: req.user.id,
      sentTo: regularUserIds,
      totalSent: subscriptions.length
    });

    const payload = JSON.stringify({
      title,
      body: message,
      icon: '/logo192.png',
      url,
      data: { url }
    });

    // Send notifications (same logic as above)
    const deliveryPromises = subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(subscription, payload);
        
        notification.deliveryStatus.push({
          userId: subscription.userId._id,
          status: 'delivered',
          deliveredAt: new Date()
        });
        
        return { success: true };
      } catch (error) {
        if (error.statusCode === 410) {
          await Subscription.findByIdAndUpdate(subscription._id, { isActive: false });
        }
        
        notification.deliveryStatus.push({
          userId: subscription.userId._id,
          status: 'failed',
          error: error.message
        });
        
        return { success: false };
      }
    });

    const results = await Promise.all(deliveryPromises);
    const delivered = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    notification.totalDelivered = delivered;
    notification.totalFailed = failed;
    await notification.save();

    res.status(200).json({
      status: 'success',
      message: 'Notification sent to regular users successfully',
      data: {
        notificationId: notification._id,
        totalSent: subscriptions.length,
        delivered,
        failed
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get notification history (Admin only)
exports.getNotificationHistory = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      PushNotification.find()
        .populate('sentBy', 'username email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      PushNotification.countDocuments()
    ]);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      status: 'success',
      data: {
        notifications,
        pagination: {
          currentPage: page,
          totalPages,
          totalNotifications: total,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get user's subscription status
exports.getSubscriptionStatus = async (req, res, next) => {
  try {
    const activeSubscriptions = await Subscription.countDocuments({
      userId: req.user.id,
      isActive: true
    });

    res.status(200).json({
      status: 'success',
      data: {
        hasActiveSubscription: activeSubscriptions > 0,
        subscriptionCount: activeSubscriptions
      }
    });
  } catch (error) {
    next(error);
  }
};

// Unsubscribe from notifications
exports.unsubscribe = async (req, res, next) => {
  try {
    await Subscription.updateMany(
      { userId: req.user.id },
      { isActive: false }
    );

    res.status(200).json({
      status: 'success',
      message: 'Unsubscribed successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Get VAPID public key
exports.getVapidPublicKey = async (req, res, next) => {
  try {
    res.status(200).json({
      status: 'success',
      publicKey: process.env.VAPID_PUBLIC_KEY
    });
  } catch (error) {
    next(error);
  }
};