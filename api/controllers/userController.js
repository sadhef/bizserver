const User = require('../models/User');
const Progress = require('../models/Progress');
const { AppError } = require('../../utils/errorHandler');

// Get all users (admin only)
exports.getAllUsers = async (req, res, next) => {
  try {
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

// Get user by ID (admin only)
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

// Approve user
exports.approveUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        status: 'approved',
        approvedBy: req.user.id,
        approvedAt: new Date()
      },
      { new: true, runValidators: true }
    );

    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.status(200).json({
      status: 'success',
      message: 'User approved successfully',
      user
    });
  } catch (error) {
    next(error);
  }
};

// Reject user
exports.rejectUser = async (req, res, next) => {
  try {
    const { reason } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        status: 'rejected',
        rejectionReason: reason || 'No reason provided',
        approvedBy: req.user.id,
        approvedAt: new Date()
      },
      { new: true, runValidators: true }
    );

    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.status(200).json({
      status: 'success',
      message: 'User rejected successfully',
      user
    });
  } catch (error) {
    next(error);
  }
};

// Suspend user
exports.suspendUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status: 'suspended' },
      { new: true, runValidators: true }
    );

    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.status(200).json({
      status: 'success',
      message: 'User suspended successfully',
      user
    });
  } catch (error) {
    next(error);
  }
};

// Delete user
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Also delete user's progress
    await Progress.deleteMany({ userId: req.params.id });

    res.status(204).json({
      status: 'success',
      message: 'User deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Get user statistics
exports.getUserStats = async (req, res, next) => {
  try {
    const stats = await User.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalUsers = await User.countDocuments({ isAdmin: { $ne: true } });

    res.status(200).json({
      status: 'success',
      stats: {
        total: totalUsers,
        breakdown: stats
      }
    });
  } catch (error) {
    next(error);
  }
};

// Update user profile
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, phone, education, institution, location, bio } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name, phone, education, institution, location, bio },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    next(error);
  }
};