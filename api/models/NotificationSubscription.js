const mongoose = require('mongoose');

const notificationSubscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  subscription: {
    endpoint: {
      type: String,
      required: true
    },
    keys: {
      p256dh: {
        type: String,
        required: true
      },
      auth: {
        type: String,
        required: true
      }
    }
  },
  preferences: {
    reminderNotifications: {
      type: Boolean,
      default: true
    },
    dueNotifications: {
      type: Boolean,
      default: true
    },
    overdueNotifications: {
      type: Boolean,
      default: true
    },
    quietHours: {
      enabled: {
        type: Boolean,
        default: false
      },
      startTime: {
        type: String,
        default: '22:00'
      },
      endTime: {
        type: String,
        default: '08:00'
      }
    },
    notificationSound: {
      type: String,
      enum: ['default', 'gentle', 'urgent', 'silent'],
      default: 'default'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastNotificationSent: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save middleware to update the updatedAt field
notificationSubscriptionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to check if user is in quiet hours
notificationSubscriptionSchema.methods.isInQuietHours = function() {
  if (!this.preferences.quietHours.enabled) return false;
  
  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();
  
  const [startHour, startMin] = this.preferences.quietHours.startTime.split(':').map(Number);
  const [endHour, endMin] = this.preferences.quietHours.endTime.split(':').map(Number);
  
  const startTime = startHour * 60 + startMin;
  const endTime = endHour * 60 + endMin;
  
  if (startTime < endTime) {
    return currentTime >= startTime && currentTime <= endTime;
  } else {
    // Quiet hours span midnight
    return currentTime >= startTime || currentTime <= endTime;
  }
};

// Method to update last notification sent time
notificationSubscriptionSchema.methods.updateLastNotificationSent = function() {
  this.lastNotificationSent = new Date();
  return this.save();
};

const NotificationSubscription = mongoose.model('NotificationSubscription', notificationSubscriptionSchema);

module.exports = NotificationSubscription;