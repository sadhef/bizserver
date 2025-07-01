const mongoose = require('mongoose');

const progressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true // One progress record per user
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  totalTimeLimit: {
    type: Number,
    default: 3600 // Default: 1 hour in seconds
  },
  timeRemaining: {
    type: Number,
    default: 3600
  },
  currentLevel: {
    type: Number,
    default: 1
  },
  completedLevels: [{
    type: Number
  }],
  completed: {
    type: Boolean,
    default: false
  },
  completedAt: {
    type: Date
  },
  // Track flag attempts for each level
  levelAttempts: {
    type: Map,
    of: {
      attempts: { type: Number, default: 0 },
      flags: [String], // Store all attempted flags
      completedAt: Date
    },
    default: () => new Map()
  },
  // Track hint usage for each level
  levelHints: {
    type: Map,
    of: Boolean,
    default: () => new Map()
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  finalScore: {
    type: Number,
    default: 0
  },
  timeExpired: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for efficient queries
progressSchema.index({ userId: 1 });
progressSchema.index({ completed: 1 });
progressSchema.index({ timeExpired: 1 });

// Method to check if time has expired
progressSchema.methods.isTimeExpired = function() {
  if (this.completed || this.timeExpired) return true;
  
  const now = new Date();
  const elapsed = Math.floor((now - this.startTime) / 1000);
  const remaining = Math.max(0, this.totalTimeLimit - elapsed);
  
  if (remaining <= 0) {
    this.timeExpired = true;
    this.timeRemaining = 0;
    return true;
  }
  
  this.timeRemaining = remaining;
  return false;
};

// Method to add flag attempt
progressSchema.methods.addFlagAttempt = function(level, flag) {
  const levelStr = level.toString();
  
  if (!this.levelAttempts.has(levelStr)) {
    this.levelAttempts.set(levelStr, {
      attempts: 0,
      flags: [],
      completedAt: null
    });
  }
  
  const attemptData = this.levelAttempts.get(levelStr);
  attemptData.attempts += 1;
  attemptData.flags.push(flag);
  
  this.levelAttempts.set(levelStr, attemptData);
  this.lastActivity = new Date();
};

// Method to complete level
progressSchema.methods.completeLevel = function(level) {
  if (!this.completedLevels.includes(level)) {
    this.completedLevels.push(level);
    this.currentLevel = level + 1;
    
    // Mark level as completed in attempts
    const levelStr = level.toString();
    if (this.levelAttempts.has(levelStr)) {
      const attemptData = this.levelAttempts.get(levelStr);
      attemptData.completedAt = new Date();
      this.levelAttempts.set(levelStr, attemptData);
    }
    
    this.lastActivity = new Date();
  }
};

// Method to use hint
progressSchema.methods.useHint = function(level) {
  this.levelHints.set(level.toString(), true);
  this.lastActivity = new Date();
};

// Method to check if hint was used
progressSchema.methods.isHintUsed = function(level) {
  return this.levelHints.get(level.toString()) || false;
};

// Static method to get or create progress for user
progressSchema.statics.getOrCreateProgress = async function(userId, settings) {
  let progress = await this.findOne({ userId });
  
  if (!progress) {
    const timeLimit = settings?.defaultTimeLimit || 3600;
    progress = await this.create({
      userId,
      totalTimeLimit: timeLimit,
      timeRemaining: timeLimit,
      startTime: new Date()
    });
  }
  
  return progress;
};

module.exports = mongoose.model('Progress', progressSchema);