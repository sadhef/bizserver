const express = require('express');
const User = require('../models/User');
const { protect, restrictToAdmin } = require('../middleware/auth');
const { AppError } = require('../../utils/errorHandler');

const router = express.Router();

// Apply authentication and admin restriction to all routes
router.use(protect);
router.use(restrictToAdmin);

// GET /api/admin/users - Get all users for admin
router.get('/users', async (req, res, next) => {
  try {
    const users = await User.find({})
      .select('_id name email isAdmin isCloud createdAt lastLogin')
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: 'success',
      results: users.length,
      users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    next(error);
  }
});

// GET /api/admin/stats - Get admin statistics
router.get('/stats', async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const adminUsers = await User.countDocuments({ isAdmin: true });
    const cloudUsers = await User.countDocuments({ isCloud: true });
    const regularUsers = await User.countDocuments({ isAdmin: false, isCloud: false });

    const recentUsers = await User.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });

    res.status(200).json({
      status: 'success',
      stats: {
        totalUsers,
        adminUsers,
        cloudUsers,
        regularUsers,
        recentUsers
      }
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    next(error);
  }
});

module.exports = router;