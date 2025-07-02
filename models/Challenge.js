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
    trim: true
  },
  description: { 
    type: String, 
    required: true,
    trim: true
  },
  hint: { 
    type: String,
    trim: true
  },
  flag: { 
    type: String, 
    required: true,
    trim: true
  },
  isActive: { 
    type: Boolean, 
    default: true 
  }
}, { 
  timestamps: true 
});

// Methods
challengeSchema.methods.validateFlag = function(submittedFlag) {
  return submittedFlag.trim().toLowerCase() === this.flag.trim().toLowerCase();
};

challengeSchema.methods.getPublicData = function() {
  return {
    _id: this._id,
    level: this.level,
    title: this.title,
    description: this.description,
    hint: this.hint
  };
};

// Static methods
challengeSchema.statics.getActiveByLevel = function(level) {
  return this.findOne({ level, isActive: true });
};

module.exports = mongoose.model('Challenge', challengeSchema);