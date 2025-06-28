const cron = require('node-cron');
const { processDueTasks } = require('../api/controllers/notificationController');

class NotificationService {
  constructor() {
    this.jobs = new Map();
  }

  /**
   * Start all scheduled notification jobs
   */
  startScheduledJobs() {
    console.log('🔔 Starting notification service...');

    // Check for due tasks every 5 minutes
    const dueTasksJob = cron.schedule('*/5 * * * *', async () => {
      try {
        console.log('🔍 Checking for due tasks...');
        const result = await processDueTasks();
        console.log(`✅ Processed ${result.tasksProcessed} tasks, sent ${result.notificationsSent} notifications`);
      } catch (error) {
        console.error('❌ Error in due tasks cron job:', error);
      }
    }, {
      scheduled: false
    });

    // Clean up old notification records daily at 2 AM
    const cleanupJob = cron.schedule('0 2 * * *', async () => {
      try {
        console.log('🧹 Running notification cleanup...');
        await this.cleanupOldNotifications();
        console.log('✅ Notification cleanup completed');
      } catch (error) {
        console.error('❌ Error in cleanup cron job:', error);
      }
    }, {
      scheduled: false
    });

    // Start the jobs
    dueTasksJob.start();
    cleanupJob.start();

    // Store job references
    this.jobs.set('dueTasks', dueTasksJob);
    this.jobs.set('cleanup', cleanupJob);

    console.log('✅ Notification service started successfully');
  }

  /**
   * Stop all scheduled jobs
   */
  stopScheduledJobs() {
    console.log('🛑 Stopping notification service...');
    
    this.jobs.forEach((job, name) => {
      job.stop();
      console.log(`✅ Stopped ${name} job`);
    });
    
    this.jobs.clear();
    console.log('✅ All notification jobs stopped');
  }

  /**
   * Clean up old notification records (older than 30 days)
   */
  async cleanupOldNotifications() {
    const TodoTask = require('../api/models/TodoTask');
    const NotificationSubscription = require('../api/models/NotificationSubscription');
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    try {
      // Clean up old notification records from tasks
      const result = await TodoTask.updateMany(
        {},
        {
          $pull: {
            notificationsSent: {
              sentAt: { $lt: thirtyDaysAgo }
            }
          }
        }
      );

      // Remove inactive subscriptions older than 30 days
      const removedSubscriptions = await NotificationSubscription.deleteMany({
        isActive: false,
        updatedAt: { $lt: thirtyDaysAgo }
      });

      console.log(`🧹 Cleanup completed: Modified ${result.modifiedCount} tasks, removed ${removedSubscriptions.deletedCount} inactive subscriptions`);
      
      return {
        modifiedTasks: result.modifiedCount,
        removedSubscriptions: removedSubscriptions.deletedCount
      };
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
      throw error;
    }
  }

  /**
   * Send immediate notification for a specific task
   */
  async sendImmediateNotification(taskId, notificationType) {
    try {
      const TodoTask = require('../api/models/TodoTask');
      
      const task = await TodoTask.findById(taskId).populate('assignedTo', 'name email');
      
      if (!task) {
        throw new Error('Task not found');
      }

      const { sendNotificationToUser } = require('../api/controllers/notificationController');
      
      const notificationData = {
        title: this.getNotificationTitle(notificationType, task),
        body: this.getNotificationBody(notificationType, task),
        icon: '/biztras.png',
        badge: '/biztras.png',
        data: {
          type: notificationType,
          taskId: task._id.toString(),
          url: '/cloud-dashboard/todos'
        }
      };

      const sent = await sendNotificationToUser(task.assignedTo._id, notificationData);
      
      if (sent) {
        await task.recordNotificationSent(notificationType);
        console.log(`✅ Immediate notification sent for task ${taskId}`);
        return true;
      } else {
        console.log(`❌ Failed to send immediate notification for task ${taskId}`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Error sending immediate notification for task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Get notification title based on type and task
   */
  getNotificationTitle(type, task) {
    switch (type) {
      case 'reminder':
        return `📋 Reminder: ${task.title}`;
      case 'due':
        return `⏰ Task Due: ${task.title}`;
      case 'overdue':
        return `🚨 Overdue: ${task.title}`;
      case 'created':
        return `📋 New Task: ${task.title}`;
      case 'updated':
        return `📝 Task Updated: ${task.title}`;
      default:
        return `📋 ${task.title}`;
    }
  }

  /**
   * Get notification body based on type and task
   */
  getNotificationBody(type, task) {
    const dueDate = new Date(task.dueDate).toLocaleString();
    
    switch (type) {
      case 'reminder':
        return `Your task "${task.title}" is due at ${dueDate}`;
      case 'due':
        return `Your task "${task.title}" is due now!`;
      case 'overdue':
        return `Your task "${task.title}" was due at ${dueDate}`;
      case 'created':
        return `New task created with due date: ${dueDate}`;
      case 'updated':
        return `Task has been updated. Due date: ${dueDate}`;
      default:
        return `Task: ${task.title}`;
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isRunning: this.jobs.size > 0,
      activeJobs: Array.from(this.jobs.keys()),
      jobCount: this.jobs.size
    };
  }
}

// Create singleton instance
const notificationService = new NotificationService();

module.exports = notificationService;