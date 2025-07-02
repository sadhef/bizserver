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

module.exports = mongoose.model('User', userSchema);