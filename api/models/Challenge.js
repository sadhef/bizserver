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
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'easy'
  },
  points: {
    type: Number,
    default: 100,
    min: [1, 'Points must be at least 1']
  },
  category: {
    type: String,
    enum: ['frontend', 'backend', 'fullstack', 'algorithms', 'databases', 'security'],
    default: 'algorithms'
  },
  tags: [{
    type: String,
    trim: true
  }],
  timeLimit: {
    type: Number, // in minutes
    default: 60
  },
  content: {
    instructions: {
      type: String,
      default: ''
    },
    resources: [{
      type: String
    }],
    hints: [{
      type: String
    }]
  },
  enabled: {
    type: Boolean,
    default: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  completionCount: {
    type: Number,
    default: 0
  },
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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

// Index for better query performance
challengeSchema.index({ enabled: 1, createdAt: -1 });
challengeSchema.index({ levelNumber: 1 });
challengeSchema.index({ difficulty: 1 });
challengeSchema.index({ category: 1 });

module.exports = mongoose.model('Challenge', challengeSchema);