const mongoose = require('mongoose');

const progressSchema = new mongoose.Schema({
  userEmail: {
    type: String,
    required: true,
    unique: true
  },
  userName: {
    type: String,
    required: true
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  timeRemaining: {
    type: Number,
    default: 3600
  },
  currentLevel: {
    type: Number,
    default: 1
  },
  levelStatus: {
    1: { type: Boolean, default: false },
    2: { type: Boolean, default: false },
    3: { type: Boolean, default: false },
    4: { type: Boolean, default: false }
  },
  flagsEntered: {
    type: Map,
    of: String,
    default: {}
  },
  attemptCounts: {
    1: { type: Number, default: 0 },
    2: { type: Number, default: 0 },
    3: { type: Number, default: 0 },
    4: { type: Number, default: 0 }
  },
  hintUsed: {
    1: { type: Boolean, default: false },
    2: { type: Boolean, default: false },
    3: { type: Boolean, default: false },
    4: { type: Boolean, default: false }
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Progress', progressSchema);