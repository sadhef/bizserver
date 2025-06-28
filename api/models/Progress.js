const mongoose = require('mongoose');

const progressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  currentLevel: {
    type: Number,
    default: 1,
    min: 1
  },
  completed: {
    type: Boolean,
    default: false
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date,
    default: null
  },
  timeRemaining: {
    type: Number,
    default: 3600 // 1 hour in seconds
  },
  totalTimeLimit: {
    type: Number,
    default: 3600 // 1 hour in seconds
  },
  // Map of level number (string) to boolean (completed or not)
  levelStatus: {
    type: Map,
    of: Boolean,
    default: new Map()
  },
  // Map of level number (string) to array of flag attempts
  flagsAttempted: {
    type: Map,
    of: [{
      flag: String,
      timestamp: Date,
      correct: Boolean
    }],
    default: new Map()
  },
  // Map of level number (string) to attempt count
  attemptCounts: {
    type: Map,
    of: Number,
    default: new Map()
  },
  // Map of level number (string) to boolean (hint used or not)
  hintsUsed: {
    type: Map,
    of: Boolean,
    default: new Map()
  }
}, {
  timestamps: true
});

// Method to get completed levels as an array
progressSchema.methods.getCompletedLevels = function() {
  const completed = [];
  if (this.levelStatus) {
    for (const [level, isCompleted] of this.levelStatus.entries()) {
      if (isCompleted) {
        completed.push(parseInt(level));
      }
    }
  }
  return completed.sort((a, b) => a - b);
};

// Static method to get latest report or create default
progressSchema.statics.getLatestReport = async function(userId) {
  let progress = await this.findOne({ userId });
  
  if (!progress) {
    // Create new progress for user
    const Setting = require('./Setting');
    const settings = await Setting.findOne();
    const defaultTimeLimit = settings ? settings.defaultTimeLimit : 3600;
    
    progress = await this.create({
      userId,
      timeRemaining: defaultTimeLimit,
      totalTimeLimit: defaultTimeLimit
    });
  }
  
  return progress;
};

module.exports = mongoose.model('Progress', progressSchema);