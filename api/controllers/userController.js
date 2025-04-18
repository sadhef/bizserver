const User = require('../models/User');
const Progress = require('../models/Progress');
const { AppError } = require('../../utils/errorHandler');
const config = require('../../config/config');

/**
 * Get all users (admin only)
 * @route GET /api/users
 * @access Private (Admin)
 */
exports.getAllUsers = async (req, res, next) => {
  try {
    // Get all users except admins
    const users = await User.find({ isAdmin: { $ne: true } })
      .select('-password')
      .sort({ registrationTime: -1 });
    
    res.status(200).json({
      status: 'success',
      results: users.length,
      users
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user by ID (admin only)
 * @route GET /api/users/:id
 * @access Private (Admin)
 */
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    res.status(200).json({
      status: 'success',
      user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user (admin only)
 * @route PATCH /api/users/:id
 * @access Private (Admin)
 */
exports.updateUser = async (req, res, next) => {
  try {
    // Prevent updating sensitive fields
    const { password, isAdmin, ...updateData } = req.body;
    
    // Update timestamp
    updateData.updatedAt = Date.now();
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    res.status(200).json({
      status: 'success',
      user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete user (admin only)
 * @route DELETE /api/users/:id
 * @access Private (Admin)
 */
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    // Also delete user progress
    await Progress.findOneAndDelete({ userId: req.params.id });
    
    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create new admin user (super admin only)
 * This route would typically be protected with additional security
 * @route POST /api/users/admin
 * @access Private (Super Admin)
 */
exports.createAdminUser = async (req, res, next) => {
  try {
    // Check if user has super admin privileges
    if (!req.user.isSuperAdmin) {
      throw new AppError('You do not have permission to perform this action', 403);
    }
    
    const { name, email, password } = req.body;
    
    // Check if admin already exists
    const existingAdmin = await User.findOne({ email });
    if (existingAdmin) {
      throw new AppError('Admin with this email already exists', 400);
    }
    
    // Create new admin user
    const admin = await User.create({
      name,
      email,
      password,
      isAdmin: true,
      registrationTime: new Date()
    });
    
    // Remove password from response
    admin.password = undefined;
    
    res.status(201).json({
      status: 'success',
      admin
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user statistics (admin only)
 * @route GET /api/users/stats
 * @access Private (Admin)
 */
exports.getUserStats = async (req, res, next) => {
  try {
    // Total users count
    const totalUsers = await User.countDocuments({ isAdmin: { $ne: true } });
    
    // Users registered today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const usersToday = await User.countDocuments({
      isAdmin: { $ne: true },
      registrationTime: { $gte: today }
    });
    
    // Users registered this week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const usersThisWeek = await User.countDocuments({
      isAdmin: { $ne: true },
      registrationTime: { $gte: oneWeekAgo }
    });
    
    // Users by institution
    const usersByInstitution = await User.aggregate([
      { $match: { isAdmin: { $ne: true } } },
      { $group: { _id: '$institution', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    // Format institution data
    const institutionData = usersByInstitution.map(item => ({
      institution: item._id || 'Unknown',
      count: item.count
    }));
    
    // Latest registered users
    const latestUsers = await User.find({ isAdmin: { $ne: true } })
      .select('name email institution registrationTime')
      .sort({ registrationTime: -1 })
      .limit(5);
    
    res.status(200).json({
      status: 'success',
      stats: {
        totalUsers,
        usersToday,
        usersThisWeek,
        institutionData,
        latestUsers
      }
    });
  } catch (error) {
    next(error);
  }
};