const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
  defaultTimeLimit: {
    type: Number,
    default: 3600, // 1 hour in seconds
    min: [300, 'Default time limit must be at least 5 minutes (300 seconds)'],
    max: [86400, 'Default time limit cannot exceed 24 hours (86400 seconds)']
  },
  maxAttempts: {
    type: Number,
    default: 0, // 0 means unlimited
    min: [0, 'Max attempts cannot be negative']
  },
  hintPenalty: {
    type: Number,
    default: 0, // Time penalty in seconds for using hints
    min: [0, 'Hint penalty cannot be negative']
  },
  systemName: {
    type: String,
    default: 'BizTras Challenge System',
    maxlength: [100, 'System name cannot exceed 100 characters']
  },
  maintenanceMode: {
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

// Update the updatedAt field before saving
settingSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Setting', settingSchema);

// utils/timer.js - Helper functions for time formatting
exports.formatTimeRemaining = (seconds) => {
  if (seconds <= 0) return 'Time Expired';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
};

exports.formatTimeDetailed = (seconds) => {
  if (seconds <= 0) return 'No time';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0 && minutes > 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''} and ${minutes} minute${minutes !== 1 ? 's' : ''}`;
  } else if (hours > 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  } else {
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  }
};