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

// Static method to get settings (create default if not exists)
settingSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  
  if (!settings) {
    settings = await this.create({
      defaultTimeLimit: 3600,
      maxAttempts: 0,
      hintPenalty: 0,
      systemName: 'BizTras Challenge System',
      maintenanceMode: false
    });
  }
  
  return settings;
};

// Create the model
const Setting = mongoose.model('Setting', settingSchema);

module.exports = Setting;