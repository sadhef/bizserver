const mongoose = require('mongoose');
const Setting = require('./Setting');

const progressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  totalTimeLimit: {
    type: Number,
    default: 3600 // Default time limit: 1 hour (will be overridden by settings)
  },
  timeRemaining: {
    type: Number,
    default: 3600 // Default time limit: 1 hour (will be overridden by settings)
  },
  currentLevel: {
    type: Number,
    default: 1
  },
  // Store progress for each level dynamically
  levelStatus: {
    type: Map,
    of: Boolean,
    default: () => new Map()
  },
  // Store all flag attempts for each level
  flagsAttempted: {
    type: Map,
    of: [String],
    default: () => new Map()
  },
  // Track attempt counts for each level
  attemptCounts: {
    type: Map,
    of: Number,
    default: () => new Map()
  },
  // Track if hints were used for each level
  hintsUsed: {
    type: Map, 
    of: Boolean,
    default: () => new Map()
  },
  completed: {
    type: Boolean,
    default: false
  },
  completedAt: {
    type: Date
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient lookups
progressSchema.index({ userId: 1 });

// Method to check if a level is completed
progressSchema.methods.isLevelCompleted = function(levelNumber) {
  return this.levelStatus.get(levelNumber.toString()) || false;
};

// Method to get all completed levels
progressSchema.methods.getCompletedLevels = function() {
  const completedLevels = [];
  this.levelStatus.forEach((value, key) => {
    if (value) completedLevels.push(parseInt(key));
  });
  return completedLevels.sort((a, b) => a - b);
};

// Method to update level completion
progressSchema.methods.completeLevel = function(levelNumber) {
  this.levelStatus.set(levelNumber.toString(), true);
  this.lastUpdated = new Date();
  return this.save();
};

// Method to add a flag attempt
progressSchema.methods.addFlagAttempt = function(levelNumber, flag) {
  const level = levelNumber.toString();
  
  // Initialize arrays if they don't exist
  if (!this.flagsAttempted.has(level)) {
    this.flagsAttempted.set(level, []);
  }
  
  // Add the flag to attempts
  const attempts = this.flagsAttempted.get(level) || [];
  attempts.push(flag);
  this.flagsAttempted.set(level, attempts);
  
  // Increment attempt count
  const currentCount = this.attemptCounts.get(level) || 0;
  this.attemptCounts.set(level, currentCount + 1);
  
  this.lastUpdated = new Date();
  return this.save();
};

// Method to use a hint
progressSchema.methods.useHint = function(levelNumber) {
  this.hintsUsed.set(levelNumber.toString(), true);
  this.lastUpdated = new Date();
  return this.save();
};

// Static method to create a new progress with the current time limit from settings
progressSchema.statics.createWithTimeLimit = async function(userId) {
  // Get current time limit from settings
  const settings = await Setting.getSettings();
  const timeLimit = settings ? settings.defaultTimeLimit : 3600; // Default to 1 hour if no settings
  
  const progress = await this.create({
    userId,
    totalTimeLimit: timeLimit,
    timeRemaining: timeLimit,
    startTime: new Date(),
    currentLevel: 1
  });
  
  return progress;
};

// Pre-save hook to update lastUpdated
progressSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

const Progress = mongoose.model('Progress', progressSchema);

module.exports = Progress;