const express = require('express');
const router = express.Router();
const { protect, restrictToCloud } = require('../middleware/auth');
const BackupServer = require('../models/BackupServer');
const { AppError } = require('../../utils/errorHandler');

// Get backup server data
router.get('/data', protect, restrictToCloud, async (req, res, next) => {
  try {
    // Get the latest report or create a default one if none exists
    const report = await BackupServer.getLatestReport(req.user.id);
    
    res.status(200).json({
      status: 'success',
      data: {
        reportTitle: report.reportTitle, // FIX: Properly return reportTitle from DB
        reportDates: report.reportDates,
        columns: report.columns,
        rows: report.rows,
        updatedAt: report.updatedAt
      }
    });
  } catch (error) {
    console.error('Error fetching backup server data:', error);
    return next(new AppError('Failed to fetch backup server data', 500));
  }
});

// Save backup server data
router.post('/save', protect, restrictToCloud, async (req, res, next) => {
  try {
    const { 
      columns, 
      rows, 
      reportTitle, // FIX: Properly handle reportTitle from request
      reportDates
    } = req.body;
    
    // Validate the data
    if (!columns || !Array.isArray(columns)) {
      return next(new AppError('Columns must be an array', 400));
    }
    
    if (!rows || !Array.isArray(rows)) {
      return next(new AppError('Rows must be an array', 400));
    }
    
    // Get the latest report
    let report = await BackupServer.getLatestReport(req.user.id);
    
    // Update the report data
    report.reportTitle = reportTitle || 'Backup Server Cronjob Status'; // FIX: Properly handle reportTitle
    report.reportDates = reportDates || {
      startDate: new Date(),
      endDate: new Date()
    };
    report.columns = columns;
    report.rows = rows;
    report.updatedBy = req.user.id;
    
    // Save the updated report
    await report.save();
    
    res.status(200).json({
      status: 'success',
      message: 'Backup server data saved successfully'
    });
  } catch (error) {
    console.error('Error saving backup server data:', error);
    return next(new AppError('Failed to save backup server data', 500));
  }
});

// Get backup server report history
router.get('/history', protect, restrictToCloud, async (req, res, next) => {
  try {
    const reports = await BackupServer.find()
      .sort({ updatedAt: -1 })
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');
    
    res.status(200).json({
      status: 'success',
      results: reports.length,
      data: {
        reports
      }
    });
  } catch (error) {
    console.error('Error fetching backup server history:', error);
    return next(new AppError('Failed to fetch backup server history', 500));
  }
});

// Create new backup server report
router.post('/new', protect, restrictToCloud, async (req, res, next) => {
  try {
    const newReport = await BackupServer.create({
      createdBy: req.user.id,
      updatedBy: req.user.id
    });
    
    res.status(201).json({
      status: 'success',
      data: {
        report: newReport
      }
    });
  } catch (error) {
    console.error('Error creating new backup server report:', error);
    return next(new AppError('Failed to create new backup server report', 500));
  }
});

module.exports = router;