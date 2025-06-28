const webpush = require('web-push');
const NotificationSubscription = require('../models/NotificationSubscription');
const TodoTask = require('../models/TodoTask');
const { AppError } = require('../../utils/errorHandler');

// Configure web-push with VAPID keys
webpush.setVapidDetails(
  'mailto:' + (process.env.VAPID_EMAIL || 'admin@biztras.com'),
  process.env.VAPID_PUBLIC_KEY || 'your-vapid-public-key',
  process.env.VAPID_PRIVATE_KEY || 'your-vapid-private-key'
);

/**
 * Subscribe user to push notifications
 * @route POST /api/notifications/subscribe
 * @access Private (Cloud Users)
 */
exports.subscribe = async (req, res, next) => {
  try {
    const { subscription, preferences } = req.body;
    
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      throw new AppError('Invalid subscription data', 400);
    }
    
    // Create or update subscription
    const notificationSubscription = await NotificationSubscription.findOneAndUpdate(
      { userId: req.user.id },
      {
        subscription,
        preferences: preferences || {},
        isActive: true
      },
      {
        upsert: true,
        new: true,
        runValidators: true
      }
    );
    
    res.status(200).json({
      status: 'success',
      message: 'Successfully subscribed to notifications',
      subscription: notificationSubscription
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Unsubscribe user from push notifications
 * @route DELETE /api/notifications/unsubscribe
 * @access Private (Cloud Users)
 */
exports.unsubscribe = async (req, res, next) => {
  try {
    await NotificationSubscription.findOneAndUpdate(
      { userId: req.user.id },
      { isActive: false }
    );
    
    res.status(200).json({
      status: 'success',
      message: 'Successfully unsubscribed from notifications'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update notification preferences
 * @route PATCH /api/notifications/preferences
 * @access Private (Cloud Users)
 */
exports.updatePreferences = async (req, res, next) => {
  try {
    const { preferences } = req.body;
    
    const subscription = await NotificationSubscription.findOneAndUpdate(
      { userId: req.user.id },
      { preferences },
      { new: true }
    );
    
    if (!subscription) {
      throw new AppError('Notification subscription not found', 404);
    }
    
    res.status(200).json({
      status: 'success',
      message: 'Preferences updated successfully',
      preferences: subscription.preferences
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's notification preferences
 * @route GET /api/notifications/preferences
 * @access Private (Cloud Users)
 */
exports.getPreferences = async (req, res, next) => {
  try {
    const subscription = await NotificationSubscription.findOne({ userId: req.user.id });
    
    if (!subscription) {
      // Return default preferences if no subscription exists
      return res.status(200).json({
        status: 'success',
        preferences: {
          reminderNotifications: true,
          dueNotifications: true,
          overdueNotifications: true,
          quietHours: {
            enabled: false,
            startTime: '22:00',
            endTime: '08:00'
          },
          notificationSound: 'default'
        },
        isSubscribed: false
      });
    }
    
    res.status(200).json({
      status: 'success',
      preferences: subscription.preferences,
      isSubscribed: subscription.isActive
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send test notification
 * @route POST /api/notifications/test
 * @access Private (Cloud Users)
 */
exports.sendTestNotification = async (req, res, next) => {
  try {
    const subscription = await NotificationSubscription.findOne({ 
      userId: req.user.id,
      isActive: true 
    });
    
    if (!subscription) {
      throw new AppError('No active notification subscription found', 404);
    }
    
    const payload = JSON.stringify({
      title: 'Test Notification',
      body: 'This is a test notification from BizTras Todo System',
      icon: '/biztras.png',
      badge: '/biztras.png',
      data: {
        type: 'test',
        url: '/cloud-dashboard'
      }
    });
    
    await webpush.sendNotification(subscription.subscription, payload);
    
    res.status(200).json({
      status: 'success',
      message: 'Test notification sent successfully'
    });
  } catch (error) {
    console.error('Error sending test notification:', error);
    
    if (error.statusCode === 410) {
      // Subscription is no longer valid, deactivate it
      await NotificationSubscription.findOneAndUpdate(
        { userId: req.user.id },
        { isActive: false }
      );
    }
    
    next(new AppError('Failed to send test notification', 500));
  }
};

/**
 * Send notification to specific user
 * @param {String} userId - User ID to send notification to
 * @param {Object} notificationData - Notification payload
 */
exports.sendNotificationToUser = async (userId, notificationData) => {
  try {
    const subscription = await NotificationSubscription.findOne({ 
      userId,
      isActive: true 
    });
    
    if (!subscription) {
      console.log(`No active subscription found for user ${userId}`);
      return false;
    }
    
    // Check quiet hours
    if (subscription.isInQuietHours()) {
      console.log(`User ${userId} is in quiet hours, skipping notification`);
      return false;
    }
    
    const payload = JSON.stringify(notificationData);
    
    await webpush.sendNotification(subscription.subscription, payload);
    await subscription.updateLastNotificationSent();
    
    console.log(`Notification sent successfully to user ${userId}`);
    return true;
  } catch (error) {
    console.error(`Error sending notification to user ${userId}:`, error);
    
    if (error.statusCode === 410) {
      // Subscription is no longer valid, deactivate it
      await NotificationSubscription.findOneAndUpdate(
        { userId },
        { isActive: false }
      );
    }
    
    return false;
  }
};

/**
 * Process due tasks and send notifications
 * @route POST /api/notifications/process-due-tasks
 * @access Private (Admin only - for cron jobs)
 */
exports.processDueTasks = async (req, res, next) => {
  try {
    // This endpoint should be protected and only called by admin or cron jobs
    const dueTasks = await TodoTask.getTasksDueForNotification();
    
    let notificationsSent = 0;
    const results = [];
    
    for (const task of dueTasks) {
      const notificationsToSend = [];
      
      // Check which notifications should be sent
      if (task.shouldSendNotification('reminder')) {
        notificationsToSend.push('reminder');
      }
      
      if (task.shouldSendNotification('due')) {
        notificationsToSend.push('due');
      }
      
      if (task.shouldSendNotification('overdue')) {
        notificationsToSend.push('overdue');
      }
      
      // Send notifications
      for (const notificationType of notificationsToSend) {
        const notificationData = {
          title: getNotificationTitle(notificationType, task),
          body: getNotificationBody(notificationType, task),
          icon: '/biztras.png',
          badge: '/biztras.png',
          data: {
            type: notificationType,
            taskId: task._id.toString(),
            url: '/cloud-dashboard/todos'
          },
          actions: [
            {
              action: 'view',
              title: 'View Task'
            },
            {
              action: 'complete',
              title: 'Mark Complete'
            }
          ]
        };
        
        const sent = await exports.sendNotificationToUser(task.assignedTo._id, notificationData);
        
        if (sent) {
          await task.recordNotificationSent(notificationType);
          notificationsSent++;
          
          results.push({
            taskId: task._id,
            userId: task.assignedTo._id,
            type: notificationType,
            status: 'sent'
          });
        } else {
          results.push({
            taskId: task._id,
            userId: task.assignedTo._id,
            type: notificationType,
            status: 'failed'
          });
        }
      }
    }
    
    if (res) {
      res.status(200).json({
        status: 'success',
        message: `Processed ${dueTasks.length} tasks, sent ${notificationsSent} notifications`,
        results
      });
    }
    
    return { tasksProcessed: dueTasks.length, notificationsSent, results };
  } catch (error) {
    console.error('Error processing due tasks:', error);
    if (next) next(error);
    throw error;
  }
};

/**
 * Get notification statistics
 * @route GET /api/notifications/stats
 * @access Private (Cloud Users)
 */
exports.getNotificationStats = async (req, res, next) => {
  try {
    const subscription = await NotificationSubscription.findOne({ userId: req.user.id });
    
    if (!subscription) {
      return res.status(200).json({
        status: 'success',
        statistics: {
          isSubscribed: false,
          totalNotificationsSent: 0,
          lastNotificationSent: null
        }
      });
    }
    
    // Get tasks with notifications sent
    const tasksWithNotifications = await TodoTask.find({
      assignedTo: req.user.id,
      'notificationsSent.0': { $exists: true }
    });
    
    let totalNotificationsSent = 0;
    tasksWithNotifications.forEach(task => {
      totalNotificationsSent += task.notificationsSent.length;
    });
    
    res.status(200).json({
      status: 'success',
      statistics: {
        isSubscribed: subscription.isActive,
        totalNotificationsSent,
        lastNotificationSent: subscription.lastNotificationSent,
        preferences: subscription.preferences
      }
    });
  } catch (error) {
    next(error);
  }
};

// Helper functions for notification content
function getNotificationTitle(type, task) {
  switch (type) {
    case 'reminder':
      return `📋 Reminder: ${task.title}`;
    case 'due':
      return `⏰ Task Due: ${task.title}`;
    case 'overdue':
      return `🚨 Overdue: ${task.title}`;
    default:
      return `📋 ${task.title}`;
  }
}

function getNotificationBody(type, task) {
  const dueDate = new Date(task.dueDate).toLocaleString();
  
  switch (type) {
    case 'reminder':
      return `Your task "${task.title}" is due at ${dueDate}`;
    case 'due':
      return `Your task "${task.title}" is due now!`;
    case 'overdue':
      return `Your task "${task.title}" was due at ${dueDate}`;
    default:
      return `Task: ${task.title}`;
  }
}