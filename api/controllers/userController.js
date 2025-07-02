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
    // Get all users except the requesting admin
    const users = await User.find({ _id: { $ne: req.user.id } })
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
 * Update user (admin only) - NOW INCLUDES ROLE MANAGEMENT
 * @route PATCH /api/users/:id
 * @access Private (Admin)
 */
exports.updateUser = async (req, res, next) => {
  try {
    const { password, ...updateData } = req.body;
    
    // Prevent users from updating their own admin status
    if (req.params.id === req.user.id.toString() && 'isAdmin' in updateData) {
      throw new AppError('You cannot modify your own admin status', 400);
    }
    
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
      message: 'User updated successfully',
      user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user roles specifically (admin only)
 * @route PATCH /api/users/:id/roles
 * @access Private (Admin)
 */
exports.updateUserRoles = async (req, res, next) => {
  try {
    const { isAdmin, isCloud } = req.body;
    const userId = req.params.id;
    
    // Prevent users from updating their own admin status
    if (userId === req.user.id.toString()) {
      throw new AppError('You cannot modify your own roles', 400);
    }
    
    // Validate role values
    if (isAdmin !== undefined && typeof isAdmin !== 'boolean') {
      throw new AppError('isAdmin must be a boolean value', 400);
    }
    
    if (isCloud !== undefined && typeof isCloud !== 'boolean') {
      throw new AppError('isCloud must be a boolean value', 400);
    }
    
    const updateData = {};
    if (isAdmin !== undefined) updateData.isAdmin = isAdmin;
    if (isCloud !== undefined) updateData.isCloud = isCloud;
    updateData.updatedAt = Date.now();
    
    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    res.status(200).json({
      status: 'success',
      message: 'User roles updated successfully',
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
    const userId = req.params.id;
    
    // Prevent users from deleting themselves
    if (userId === req.user.id.toString()) {
      throw new AppError('You cannot delete your own account', 400);
    }
    
    const user = await User.findByIdAndDelete(userId);
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    // Also delete user progress
    await Progress.findOneAndDelete({ userId: userId });
    
    res.status(204).json({
      status: 'success',
      data: null
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
    const totalUsers = await User.countDocuments({ isAdmin: { $ne: true } });
    const adminUsers = await User.countDocuments({ isAdmin: true });
    const cloudUsers = await User.countDocuments({ isCloud: true });
    const regularUsers = await User.countDocuments({ isAdmin: false, isCloud: false });
    
    // Recent registrations (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentRegistrations = await User.countDocuments({
      registrationTime: { $gte: sevenDaysAgo },
      isAdmin: { $ne: true }
    });
    
    res.status(200).json({
      status: 'success',
      stats: {
        totalUsers,
        adminUsers,
        cloudUsers,
        regularUsers,
        recentRegistrations
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create new admin user (super admin only)
 * @route POST /api/users/admin
 * @access Private (Super Admin)
 */
exports.createAdminUser = async (req, res, next) => {
  try {
    // For now, any admin can create another admin
    // You can add super admin logic later if needed
    const { name, email, password, isCloud = false } = req.body;
    
    // Check if admin already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new AppError('User with this email already exists', 400);
    }
    
    // Create new admin user
    const admin = await User.create({
      name,
      email,
      password,
      isAdmin: true,
      isCloud,
      registrationTime: new Date()
    });
    
    // Remove password from response
    admin.password = undefined;
    
    res.status(201).json({
      status: 'success',
      message: 'Admin user created successfully',
      user: admin
    });
  } catch (error) {
    next(error);
  }
};