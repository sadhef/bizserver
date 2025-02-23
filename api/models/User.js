const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  phone: String,
  institution: String,
  registrationTime: {
    type: Date,
    default: Date.now
  },
  startTime: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', userSchema);