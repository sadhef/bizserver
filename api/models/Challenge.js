const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema({
  levelNumber: {
    type: Number,
    required: [true, 'Level number is required'],
    unique: true,
    min: [1, 'Level number must be at least 1']
  },
  title: {
    type: String,
    required: [true, 'Challenge title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Challenge description is required'],
    maxlength: [5000, 'Description cannot exceed 5000 characters']
  },
  hint: {
    type: String,
    required: [true, 'Challenge hint is required'],
    maxlength: [1000, 'Hint cannot exceed 1000 characters']
  },
  flag: {
    type: String,
    required: [true, 'Challenge flag is required'],
    trim: true,
    maxlength: [100, 'Flag cannot exceed 100 characters']
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

// Update the updatedAt field before saving
challengeSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Challenge', challengeSchema);