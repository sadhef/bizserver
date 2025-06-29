const mongoose = require('mongoose');

const notificationTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  token: {
    type: String,
    required: true,
    unique: true
  },
  platform: {
    type: String,
    enum: ['web', 'android', 'ios'],
    default: 'web'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastUsed: {
    type: Date,
    default: Date.now
  },
  userAgent: {
    type: String,
    default: ''
  },
  ipAddress: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
notificationTokenSchema.index({ userId: 1, isActive: 1 });
notificationTokenSchema.index({ token: 1 });
notificationTokenSchema.index({ isActive: 1, lastUsed: -1 });

// Pre-save middleware to update lastUsed
notificationTokenSchema.pre('save', function(next) {
  if (this.isModified('isActive') && this.isActive) {
    this.lastUsed = new Date();
  }
  next();
});

// Static method to clean up old inactive tokens
notificationTokenSchema.statics.cleanupOldTokens = function(daysOld = 30) {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  return this.deleteMany({
    isActive: false,
    updatedAt: { $lt: cutoffDate }
  });
};

// Static method to deactivate tokens for a user
notificationTokenSchema.statics.deactivateUserTokens = function(userId, platform = null) {
  const query = { userId, isActive: true };
  if (platform) {
    query.platform = platform;
  }
  return this.updateMany(query, { isActive: false });
};

module.exports = mongoose.model('NotificationToken', notificationTokenSchema);