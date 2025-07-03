const mongoose = require('mongoose');

const configSchema = new mongoose.Schema({
  totalTimeLimit: { 
    type: Number, 
    required: true,
    min: 1,
    max: 1440, // Maximum 24 hours
    default: 60
  },
  maxLevels: { 
    type: Number, 
    default: 2,
    min: 1,
    max: 10
  },
  challengeActive: { 
    type: Boolean, 
    default: false 
  },
  registrationOpen: {
    type: Boolean,
    default: true
  },
  allowHints: {
    type: Boolean,
    default: true
  },
  maxAttempts: {
    type: Number,
    default: -1, // -1 means unlimited
    min: -1
  },
  challengeTitle: {
    type: String,
    default: 'Re-Challenge CTF Challenge',
    maxlength: 100
  },
  challengeDescription: {
    type: String,
    default: 'Welcome to the Re-Challenge Capture The Flag Challenge!',
    maxlength: 500
  },
  thankYouMessage: {
    type: String,
    default: 'Thank you for participating in the Re-Challenge CTF Challenge!',
    maxlength: 500
  },
  adminEmails: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  challengeStartDate: {
    type: Date
  },
  challengeEndDate: {
    type: Date
  }
}, { 
  timestamps: true 
});

// Validation
configSchema.pre('save', function(next) {
  if (this.challengeStartDate && this.challengeEndDate) {
    if (this.challengeStartDate >= this.challengeEndDate) {
      return next(new Error('Challenge start date must be before end date'));
    }
  }
  next();
});

// Instance methods
configSchema.methods.isChallengeTimeActive = function() {
  const now = new Date();
  
  if (this.challengeStartDate && now < this.challengeStartDate) {
    return false;
  }
  
  if (this.challengeEndDate && now > this.challengeEndDate) {
    return false;
  }
  
  return this.challengeActive;
};

configSchema.methods.getTimeUntilStart = function() {
  if (!this.challengeStartDate) return 0;
  const now = new Date();
  return Math.max(0, Math.floor((this.challengeStartDate - now) / 1000));
};

configSchema.methods.getTimeUntilEnd = function() {
  if (!this.challengeEndDate) return 0;
  const now = new Date();
  return Math.max(0, Math.floor((this.challengeEndDate - now) / 1000));
};

// Static methods
configSchema.statics.getConfig = async function() {
  let config = await this.findOne();
  if (!config) {
    config = new this({
      totalTimeLimit: 60,
      maxLevels: 2,
      challengeActive: false
    });
    await config.save();
  }
  return config;
};

configSchema.statics.updateConfig = async function(updates) {
  let config = await this.getConfig();
  Object.assign(config, updates);
  return config.save();
};

module.exports = mongoose.model('Config', configSchema);