const mongoose = require('mongoose');

const pushNotificationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    maxlength: 100
  },
  message: {
    type: String,
    required: true,
    maxlength: 500
  },
  icon: {
    type: String,
    default: '/logo192.png'
  },
  url: {
    type: String,
    default: '/dashboard'
  },
  targetType: {
    type: String,
    enum: ['all', 'cloud_users', 'regular_users', 'specific_users'],
    required: true
  },
  sentBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sentTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  deliveryStatus: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['pending', 'delivered', 'failed'],
      default: 'pending'
    },
    deliveredAt: Date,
    error: String
  }],
  totalSent: {
    type: Number,
    default: 0
  },
  totalDelivered: {
    type: Number,
    default: 0
  },
  totalFailed: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('PushNotification', pushNotificationSchema);