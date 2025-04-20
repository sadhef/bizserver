const mongoose = require('mongoose');

const cloudReportSchema = new mongoose.Schema({
  reportTitle: {
    type: String,
    default: 'Cloud Status Report'
  },
  reportDates: {
    startDate: {
      type: Date,
      default: Date.now
    },
    endDate: {
      type: Date,
      default: Date.now
    }
  },
  columns: {
    type: [String],
    default: ['Server', 'Status', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'SSL Expiry', 'Remarks']
  },
  rows: {
    type: [mongoose.Schema.Types.Mixed],
    default: []
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

// Pre-save hook to update the 'updatedAt' timestamp
cloudReportSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Static method to get the latest report or create a default one
cloudReportSchema.statics.getLatestReport = async function(userId) {
  let report = await this.findOne().sort({ updatedAt: -1 });
  
  if (!report) {
    report = await this.create({
      createdBy: userId,
      updatedBy: userId
    });
  }
  
  return report;
};

const CloudReport = mongoose.model('CloudReport', cloudReportSchema);

module.exports = CloudReport;