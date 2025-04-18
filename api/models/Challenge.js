const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema({
  levelNumber: {
    type: Number,
    required: true,
    min: 1
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  hint: {
    type: String,
    required: true
  },
  flag: {
    type: String,
    required: true
  },
  enabled: {
    type: Boolean,
    default: true
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

// Index for quick access by level number
challengeSchema.index({ levelNumber: 1 });

// Update the updatedAt timestamp before save
challengeSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Static method to get all enabled challenges
challengeSchema.statics.getEnabledChallenges = async function() {
  return this.find({ enabled: true }).sort({ levelNumber: 1 });
};

// Static method to get number of enabled levels
challengeSchema.statics.getNumberOfLevels = async function() {
  const result = await this.aggregate([
    { $match: { enabled: true } },
    { $group: { _id: null, count: { $sum: 1 } } }
  ]);
  return result.length > 0 ? result[0].count : 0;
};

module.exports = mongoose.model('Challenge', challengeSchema);