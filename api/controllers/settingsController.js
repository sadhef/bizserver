const Setting = require('../models/Setting');
const { AppError } = require('../../utils/errorHandler');

// Get system settings (admin only)
exports.getSettings = async (req, res, next) => {
  try {
    let settings = await Setting.findOne();
    
    // Create default settings if none exist
    if (!settings) {
      settings = await Setting.create({
        defaultTimeLimit: 3600, // 1 hour
        maxAttempts: 0, // unlimited
        hintPenalty: 0, // no penalty
        systemName: 'BizTras Challenge System',
        maintenanceMode: false
      });
    }
    
    res.status(200).json({
      status: 'success',
      settings
    });
  } catch (error) {
    next(error);
  }
};

// Update system settings (admin only)
exports.updateSettings = async (req, res, next) => {
  try {
    const {
      defaultTimeLimit,
      maxAttempts,
      hintPenalty,
      systemName,
      maintenanceMode
    } = req.body;
    
    // Validate defaultTimeLimit
    if (defaultTimeLimit !== undefined) {
      if (defaultTimeLimit < 300 || defaultTimeLimit > 86400) {
        throw new AppError('Default time limit must be between 5 minutes (300 seconds) and 24 hours (86400 seconds)', 400);
      }
    }
    
    let settings = await Setting.findOne();
    
    if (!settings) {
      // Create new settings
      settings = await Setting.create({
        defaultTimeLimit: defaultTimeLimit || 3600,
        maxAttempts: maxAttempts || 0,
        hintPenalty: hintPenalty || 0,
        systemName: systemName || 'BizTras Challenge System',
        maintenanceMode: maintenanceMode || false
      });
    } else {
      // Update existing settings
      if (defaultTimeLimit !== undefined) settings.defaultTimeLimit = defaultTimeLimit;
      if (maxAttempts !== undefined) settings.maxAttempts = maxAttempts;
      if (hintPenalty !== undefined) settings.hintPenalty = hintPenalty;
      if (systemName !== undefined) settings.systemName = systemName;
      if (maintenanceMode !== undefined) settings.maintenanceMode = maintenanceMode;
      
      await settings.save();
    }
    
    res.status(200).json({
      status: 'success',
      message: 'Settings updated successfully',
      settings
    });
  } catch (error) {
    next(error);
  }
};

// Reset all settings to default (admin only)
exports.resetSettings = async (req, res, next) => {
  try {
    const defaultSettings = {
      defaultTimeLimit: 3600,
      maxAttempts: 0,
      hintPenalty: 0,
      systemName: 'BizTras Challenge System',
      maintenanceMode: false
    };
    
    const settings = await Setting.findOneAndUpdate(
      {},
      defaultSettings,
      { new: true, upsert: true }
    );
    
    res.status(200).json({
      status: 'success',
      message: 'Settings reset to defaults',
      settings
    });
  } catch (error) {
    next(error);
  }
};