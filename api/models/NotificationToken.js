// api/models/NotificationToken.js
const mongoose = require('mongoose');

const notificationTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  platform: {
    type: String,
    enum: ['web', 'android', 'ios'],
    default: 'web',
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  userAgent: {
    type: String,
    default: ''
  },
  ipAddress: {
    type: String,
    default: ''
  },
  lastUsed: {
    type: Date,
    default: Date.now,
    index: true
  },
  deviceInfo: {
    browser: String,
    os: String,
    device: String
  },
  subscriptionDetails: {
    endpoint: String,
    keys: {
      p256dh: String,
      auth: String
    }
  }
}, {
  timestamps: true
});

// Compound indexes for better query performance
notificationTokenSchema.index({ userId: 1, platform: 1 });
notificationTokenSchema.index({ userId: 1, isActive: 1 });
notificationTokenSchema.index({ isActive: 1, lastUsed: 1 });

// Static method to deactivate user's existing tokens for a platform
notificationTokenSchema.statics.deactivateUserTokens = async function(userId, platform) {
  try {
    const result = await this.updateMany(
      { userId, platform, isActive: true },
      { 
        isActive: false,
        lastUsed: new Date()
      }
    );
    console.log(`🔄 Deactivated ${result.modifiedCount} existing tokens for user ${userId} on platform ${platform}`);
    return result;
  } catch (error) {
    console.error('❌ Error deactivating user tokens:', error);
    throw error;
  }
};

// Static method to clean up old inactive tokens
notificationTokenSchema.statics.cleanupOldTokens = async function(daysOld = 30) {
  try {
    const cutoffDate = new Date(Date.now() - (daysOld * 24 * 60 * 60 * 1000));
    const result = await this.deleteMany({
      isActive: false,
      lastUsed: { $lt: cutoffDate }
    });
    console.log(`🧹 Cleaned up ${result.deletedCount} old inactive tokens`);
    return result;
  } catch (error) {
    console.error('❌ Error cleaning up old tokens:', error);
    throw error;
  }
};

// Static method to get active tokens for a user
notificationTokenSchema.statics.getActiveTokensForUser = async function(userId, platform = null) {
  try {
    const query = { userId, isActive: true };
    if (platform) {
      query.platform = platform;
    }
    
    const tokens = await this.find(query).select('token platform lastUsed');
    return tokens.map(t => t.token);
  } catch (error) {
    console.error('❌ Error getting active tokens for user:', error);
    throw error;
  }
};

// Instance method to update last used timestamp
notificationTokenSchema.methods.updateLastUsed = function() {
  this.lastUsed = new Date();
  return this.save();
};

// Instance method to deactivate token
notificationTokenSchema.methods.deactivate = function() {
  this.isActive = false;
  this.lastUsed = new Date();
  return this.save();
};

// Pre-save middleware to extract device info from user agent
notificationTokenSchema.pre('save', function(next) {
  if (this.userAgent && !this.deviceInfo.browser) {
    try {
      // Simple user agent parsing
      const ua = this.userAgent;
      
      // Extract browser
      if (ua.includes('Chrome')) this.deviceInfo.browser = 'Chrome';
      else if (ua.includes('Firefox')) this.deviceInfo.browser = 'Firefox';
      else if (ua.includes('Safari')) this.deviceInfo.browser = 'Safari';
      else if (ua.includes('Edge')) this.deviceInfo.browser = 'Edge';
      else this.deviceInfo.browser = 'Unknown';
      
      // Extract OS
      if (ua.includes('Windows')) this.deviceInfo.os = 'Windows';
      else if (ua.includes('Mac OS')) this.deviceInfo.os = 'macOS';
      else if (ua.includes('Linux')) this.deviceInfo.os = 'Linux';
      else if (ua.includes('Android')) this.deviceInfo.os = 'Android';
      else if (ua.includes('iOS')) this.deviceInfo.os = 'iOS';
      else this.deviceInfo.os = 'Unknown';
      
      // Extract device type
      if (ua.includes('Mobile')) this.deviceInfo.device = 'Mobile';
      else if (ua.includes('Tablet')) this.deviceInfo.device = 'Tablet';
      else this.deviceInfo.device = 'Desktop';
    } catch (error) {
      console.warn('⚠️ Error parsing user agent:', error);
    }
  }
  next();
});

// Virtual for token preview (first 20 characters)
notificationTokenSchema.virtual('tokenPreview').get(function() {
  return this.token ? `${this.token.substring(0, 20)}...` : '';
});

// Virtual for time since last used
notificationTokenSchema.virtual('lastUsedAgo').get(function() {
  if (!this.lastUsed) return 'Never';
  
  const now = new Date();
  const diff = now - this.lastUsed;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
});

// Ensure virtual fields are serialized
notificationTokenSchema.set('toJSON', { virtuals: true });
notificationTokenSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('NotificationToken', notificationTokenSchema);