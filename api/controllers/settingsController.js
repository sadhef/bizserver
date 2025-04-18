const Setting = require('../models/Setting');
const { AppError } = require('../../utils/errorHandler');

/**
 * Get global settings
 * @route GET /api/settings
 * @access Private
 */
exports.getSettings = async (req, res, next) => {
  try {
    // Get settings from database
    let settings = await Setting.findOne();
    
    // If no settings exist, create default settings
    if (!settings) {
      settings = await Setting.create({
        defaultTimeLimit: 3600, // Default 1 hour in seconds
        createdBy: req.user.id,
        updatedBy: req.user.id
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

/**
 * Update global settings
 * @route POST /api/settings/update
 * @access Private (Admin)
 */
exports.updateSettings = async (req, res, next) => {
  try {
    let { defaultTimeLimit } = req.body;
    
    console.log('Request body:', req.body);
    console.log('defaultTimeLimit as received:', defaultTimeLimit, typeof defaultTimeLimit);
    
    // Ensure defaultTimeLimit is a number
    if (defaultTimeLimit !== undefined) {
      // Convert to number if it's a string
      if (typeof defaultTimeLimit === 'string') {
        defaultTimeLimit = parseInt(defaultTimeLimit, 10);
      }
      
      // Check if it's a valid number after conversion
      if (isNaN(defaultTimeLimit)) {
        console.log('Invalid time limit value:', defaultTimeLimit);
        throw new AppError('Time limit must be a valid number', 400);
      }
      
      // Validate the range (5 minutes to 24 hours)
      const fiveMinutes = 5 * 60; // 300 seconds
      const twentyFourHours = 24 * 60 * 60; // 86400 seconds
      
      console.log('Validating time limit:', defaultTimeLimit, 
                  'Min:', fiveMinutes, 'Max:', twentyFourHours);
      
      if (defaultTimeLimit < fiveMinutes) {
        throw new AppError('Time limit must be at least 5 minutes (300 seconds)', 400);
      }
      
      if (defaultTimeLimit > twentyFourHours) {
        throw new AppError('Time limit cannot exceed 24 hours (86400 seconds)', 400);
      }
    }
    
    // Get existing settings or create new ones
    let settings = await Setting.findOne();
    
    if (!settings) {
      console.log('Creating new settings with defaultTimeLimit:', defaultTimeLimit);
      settings = await Setting.create({
        defaultTimeLimit: defaultTimeLimit || 3600,
        createdBy: req.user.id,
        updatedBy: req.user.id
      });
    } else {
      // Update settings
      console.log('Updating existing settings with defaultTimeLimit:', defaultTimeLimit);
      settings.defaultTimeLimit = defaultTimeLimit || settings.defaultTimeLimit;
      settings.updatedBy = req.user.id;
      settings.updatedAt = Date.now();
      await settings.save();
      
      console.log('Settings saved successfully, new value:', settings.defaultTimeLimit);
    }
    
    res.status(200).json({
      status: 'success',
      settings
    });
  } catch (error) {
    console.error('Error in updateSettings:', error);
    next(error);
  }
};