const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    lowercase: true
  },
  password: { 
    type: String, 
    required: true,
    minlength: 6
  },
  isAdmin: { 
    type: Boolean, 
    default: false 
  },
  isApproved: { 
    type: Boolean, 
    default: false 
  },
  currentLevel: { 
    type: Number, 
    default: 1,
    min: 1
  },
  completedLevels: [{ 
    type: Number,
    min: 1
  }],
  challengeStartTime: { 
    type: Date 
  },
  challengeEndTime: { 
    type: Date 
  },
  challengeCompletionTime: { // NEW: Track when challenge was completed
    type: Date
  },
  isActive: { 
    type: Boolean, 
    default: false 
  },
  submissions: [{
    level: {
      type: Number,
      required: true,
      min: 1
    },
    flag: {
      type: String,
      required: true
    },
    timestamp: { 
      type: Date, 
      default: Date.now 
    },
    isCorrect: {
      type: Boolean,
      required: true
    }
  }],
  totalAttempts: { 
    type: Number, 
    default: 0,
    min: 0
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  resetCount: { // NEW: Track how many times admin has reset this user
    type: Number,
    default: 0
  },
  lastResetTime: { // NEW: Track when last reset occurred
    type: Date
  },
  lastResetBy: { // NEW: Track which admin reset the user
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { 
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      return ret;
    }
  }
});

// Index for better query performance
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ isApproved: 1, isAdmin: 1 });
userSchema.index({ challengeEndTime: 1 });
userSchema.index({ challengeStartTime: 1 });

// Pre-save middleware to update lastActivity
userSchema.pre('save', function(next) {
  this.lastActivity = new Date();
  next();
});

// Instance methods
userSchema.methods.isTimeExpired = function() {
  if (!this.challengeEndTime) return false;
  return new Date() > this.challengeEndTime;
};

userSchema.methods.getTimeRemaining = function() {
  if (!this.challengeEndTime) return 0;
  return Math.max(0, Math.floor((this.challengeEndTime - new Date()) / 1000));
};

userSchema.methods.hasCompletedLevel = function(level) {
  return this.completedLevels.includes(level);
};

userSchema.methods.canAccessLevel = function(level) {
  if (level === 1) return true;
  return this.hasCompletedLevel(level - 1);
};

// NEW: Check if user can start a new challenge
userSchema.methods.canStartChallenge = function(maxLevels) {
  // If never started, can start
  if (!this.challengeStartTime) return { canStart: true, reason: null };
  
  // If completed all levels, cannot restart
  if (this.completedLevels.length >= maxLevels) {
    return { 
      canStart: false, 
      reason: 'Challenge completed. Contact admin to reset progress.' 
    };
  }
  
  // If time expired and not active, cannot restart
  if (this.isTimeExpired() && !this.isActive) {
    return { 
      canStart: false, 
      reason: 'Challenge time expired. Contact admin to reset progress.' 
    };
  }
  
  // If currently active, cannot start again
  if (this.isActive) {
    return { 
      canStart: false, 
      reason: 'Challenge already in progress.' 
    };
  }
  
  return { canStart: true, reason: null };
};

// NEW: Reset user challenge progress (for admin use)
userSchema.methods.resetChallengeProgress = function(adminUserId) {
  this.currentLevel = 1;
  this.completedLevels = [];
  this.submissions = [];
  this.totalAttempts = 0;
  this.challengeStartTime = null;
  this.challengeEndTime = null;
  this.challengeCompletionTime = null;
  this.isActive = false;
  this.resetCount += 1;
  this.lastResetTime = new Date();
  this.lastResetBy = adminUserId;
  
  return this;
};

// NEW: Get challenge summary
userSchema.methods.getChallengeSummary = function() {
  return {
    hasStarted: !!this.challengeStartTime,
    isActive: this.isActive,
    isCompleted: this.challengeCompletionTime !== undefined,
    isExpired: this.isTimeExpired(),
    currentLevel: this.currentLevel,
    completedLevels: this.completedLevels,
    totalAttempts: this.totalAttempts,
    timeRemaining: this.getTimeRemaining(),
    resetCount: this.resetCount,
    lastResetTime: this.lastResetTime
  };
};

module.exports = mongoose.model('User', userSchema);