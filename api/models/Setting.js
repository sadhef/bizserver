const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
  defaultTimeLimit: {
    type: Number,
    default: 3600, // Default: 1 hour in seconds
    min: 300,      // Minimum: 5 minutes
    max: 86400     // Maximum: 24 hours
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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

// There should only be one settings document in the collection
settingSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  
  if (!settings) {
    settings = await this.create({
      defaultTimeLimit: 3600 // Default to 1 hour
    });
  }
  
  return settings;
};

module.exports = mongoose.model('Setting', settingSchema);