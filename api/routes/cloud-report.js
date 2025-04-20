const express = require('express');
const router = express.Router();
const { protect, restrictToCloud } = require('../middleware/auth');
const CloudReport = require('../models/CloudReport');
const { AppError } = require('../../utils/errorHandler');

// Get cloud report data
router.get('/data', protect, restrictToCloud, async (req, res, next) => {
  try {
    // Get the latest report or create a default one if none exists
    const report = await CloudReport.getLatestReport(req.user.id);
    
    res.status(200).json({
      status: 'success',
      data: {
        reportTitle: report.reportTitle,
        reportDates: report.reportDates,
        totalSpaceUsed: report.totalSpaceUsed, // Added total space used
        columns: report.columns,
        rows: report.rows,
        updatedAt: report.updatedAt
      }
    });
  } catch (error) {
    console.error('Error fetching cloud report data:', error);
    return next(new AppError('Failed to fetch cloud report data', 500));
  }
});

// Save cloud report data
router.post('/save', protect, restrictToCloud, async (req, res, next) => {
  try {
    const { 
      columns, 
      rows, 
      reportTitle, 
      reportDates, 
      totalSpaceUsed // New field
    } = req.body;
    
    // Validate the data
    if (!columns || !Array.isArray(columns)) {
      return next(new AppError('Columns must be an array', 400));
    }
    
    if (!rows || !Array.isArray(rows)) {
      return next(new AppError('Rows must be an array', 400));
    }
    
    // Get the latest report
    let report = await CloudReport.getLatestReport(req.user.id);
    
    // Update the report data
    report.reportTitle = reportTitle || 'Cloud Status Report';
    report.reportDates = reportDates || {
      startDate: new Date(),
      endDate: new Date()
    };
    report.columns = columns;
    report.rows = rows;
    report.totalSpaceUsed = totalSpaceUsed || ''; // Add total space used
    report.updatedBy = req.user.id;
    
    // Save the updated report
    await report.save();
    
    res.status(200).json({
      status: 'success',
      message: 'Cloud report data saved successfully'
    });
  } catch (error) {
    console.error('Error saving cloud report data:', error);
    return next(new AppError('Failed to save cloud report data', 500));
  }
});

// Existing other routes remain the same
router.get('/history', protect, restrictToCloud, async (req, res, next) => {
  try {
    const reports = await CloudReport.find()
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
    console.error('Error fetching report history:', error);
    return next(new AppError('Failed to fetch report history', 500));
  }
});

router.post('/new', protect, restrictToCloud, async (req, res, next) => {
  try {
    const newReport = await CloudReport.create({
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
    console.error('Error creating new report:', error);
    return next(new AppError('Failed to create new report', 500));
  }
});

module.exports = router;