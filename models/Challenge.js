const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema({
  level: { 
    type: Number, 
    required: true, 
    unique: true,
    min: 1
  },
  title: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 100
  },
  description: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 1000
  },
  hint: { 
    type: String,
    trim: true,
    maxlength: 500
  },
  flag: { 
    type: String, 
    required: true,
    trim: true
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  difficulty: {
    type: String,
    enum: ['Easy', 'Medium', 'Hard'],
    default: 'Medium'
  },
  category: {
    type: String,
    enum: ['Web', 'Crypto', 'Forensics', 'Reverse', 'Pwn', 'Misc'],
    default: 'Web'
  },
  points: {
    type: Number,
    default: 100,
    min: 0
  },
  solveCount: {
    type: Number,
    default: 0,
    min: 0
  }
}, { 
  timestamps: true 
});

// Index for better query performance
challengeSchema.index({ level: 1 });
challengeSchema.index({ isActive: 1 });
challengeSchema.index({ difficulty: 1 });
challengeSchema.index({ category: 1 });

// Instance methods
challengeSchema.methods.incrementSolveCount = function() {
  this.solveCount += 1;
  return this.save();
};

challengeSchema.methods.validateFlag = function(submittedFlag) {
  return submittedFlag.trim().toLowerCase() === this.flag.trim().toLowerCase();
};

challengeSchema.methods.getPublicData = function() {
  return {
    _id: this._id,
    level: this.level,
    title: this.title,
    description: this.description,
    hint: this.hint,
    difficulty: this.difficulty,
    category: this.category,
    points: this.points,
    solveCount: this.solveCount
  };
};

// Static methods
challengeSchema.statics.getActiveByLevel = function(level) {
  return this.findOne({ level, isActive: true });
};

challengeSchema.statics.getAllActive = function() {
  return this.find({ isActive: true }).sort({ level: 1 });
};

module.exports = mongoose.model('Challenge', challengeSchema);