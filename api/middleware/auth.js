const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AppError } = require('../../utils/errorHandler');

// Environment variables
const JWT_SECRET = process.env.JWT_SECRET || '9ffbc51e975aa664c84b7f583d9d3fe7863257f331814869a4ac867f520177e3617b50ffa7953640d383020440de5e22d0a7b3f08bebde1e3ca1fea7c7ceba15';

// Protect routes - verify JWT token
exports.protect = async (req, res, next) => {
  try {
    let token;
    
    // Check if token exists in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    // Check if token exists
    if (!token) {
      throw new AppError('You are not logged in. Please log in to get access.', 401);
    }
    
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if user still exists
    const user = await User.findById(decoded.id);
    if (!user) {
      throw new AppError('The user belonging to this token no longer exists.', 401);
    }
    
    // Grant access to protected route
    req.user = {
      id: user._id,
      isAdmin: user.isAdmin,
      isCloud: user.isCloud
    };
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid token. Please log in again.', 401));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Your token has expired. Please log in again.', 401));
    }
    next(error);
  }
};

// Restrict to admin users
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // Check if user has admin role
    if (!roles.includes('admin') || !req.user.isAdmin) {
      return next(new AppError('You do not have permission to perform this action', 403));
    }
    
    next();
  };
};

// Create admin middleware - restrict to admin only
exports.restrictToAdmin = (req, res, next) => {
  if (!req.user.isAdmin) {
    return next(new AppError('This route is restricted to administrators', 403));
  }
  
  next();
};

// Create cloud middleware - restrict to cloud users only
exports.restrictToCloud = (req, res, next) => {
  if (!req.user.isCloud) {
    return next(new AppError('This route is restricted to cloud users', 403));
  }
  
  next();
};