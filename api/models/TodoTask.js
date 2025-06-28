const mongoose = require('mongoose');

const todoTaskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required']
  },
  reminderTime: {
    type: Date,
    required: false
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringType: {
    type: String,
    enum: ['daily', 'weekly', 'monthly'],
    required: false
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: 50
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  completedAt: {
    type: Date
  },
  notificationsSent: [{
    type: {
      type: String,
      enum: ['reminder', 'due', 'overdue']
    },
    sentAt: {
      type: Date,
      default: Date.now
    }
  }],
  isDeleted: {
    type: Boolean,
    default: false
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

// Indexes for efficient queries
todoTaskSchema.index({ createdBy: 1, status: 1 });
todoTaskSchema.index({ assignedTo: 1, dueDate: 1 });
todoTaskSchema.index({ dueDate: 1, status: 1 });

// Pre-save middleware to update the updatedAt field
todoTaskSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Set completedAt when status changes to completed
  if (this.isModified('status') && this.status === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
  }
  
  next();
});

// Virtual for checking if task is overdue
todoTaskSchema.virtual('isOverdue').get(function() {
  return this.dueDate < new Date() && this.status !== 'completed';
});

// Virtual for time remaining
todoTaskSchema.virtual('timeRemaining').get(function() {
  const now = new Date();
  const due = new Date(this.dueDate);
  return due - now;
});

// Method to mark task as completed
todoTaskSchema.methods.markCompleted = function() {
  this.status = 'completed';
  this.completedAt = new Date();
  return this.save();
};

// Method to check if notification should be sent
todoTaskSchema.methods.shouldSendNotification = function(notificationType) {
  const now = new Date();
  const due = new Date(this.dueDate);
  
  // Don't send notifications for completed tasks
  if (this.status === 'completed') return false;
  
  // Check if this type of notification was already sent
  const alreadySent = this.notificationsSent.some(n => n.type === notificationType);
  if (alreadySent) return false;
  
  switch (notificationType) {
    case 'reminder':
      return this.reminderTime && now >= new Date(this.reminderTime);
    case 'due':
      return now >= due;
    case 'overdue':
      return now > due;
    default:
      return false;
  }
};

// Method to record notification sent
todoTaskSchema.methods.recordNotificationSent = function(notificationType) {
  this.notificationsSent.push({
    type: notificationType,
    sentAt: new Date()
  });
  return this.save();
};

// Static method to get tasks due for notifications
todoTaskSchema.statics.getTasksDueForNotification = function() {
  const now = new Date();
  
  return this.find({
    status: { $ne: 'completed' },
    isDeleted: false,
    $or: [
      {
        reminderTime: { $lte: now },
        'notificationsSent.type': { $ne: 'reminder' }
      },
      {
        dueDate: { $lte: now },
        'notificationsSent.type': { $ne: 'due' }
      },
      {
        dueDate: { $lt: now },
        'notificationsSent.type': { $ne: 'overdue' }
      }
    ]
  }).populate('assignedTo', 'name email');
};

const TodoTask = mongoose.model('TodoTask', todoTaskSchema);

module.exports = TodoTask;