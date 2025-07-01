const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { AppError } = require('../../utils/errorHandler');

const JWT_SECRET = process.env.JWT_SECRET || '9ffbc51e975aa664c84b7f583d9d3fe7863257f331814869a4ac867f520177e3617b50ffa7953640d383020440de5e22d0a7b3f08bebde1e3ca1fea7c7ceba15';

// Helper function to create JWT token
const createToken = (id) => {
  return jwt.sign({ id }, JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

// Helper function to send token response
const createSendToken = (user, statusCode, res) => {
  const token = createToken(user._id);
  
  // Remove password from output
  user.password = undefined;
  
  res.status(statusCode).json({
    status: 'success',
    token,
    user
  });
};

// Register new user
exports.register = async (req, res, next) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      education,
      institution,
      location
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new AppError('User with this email already exists', 400);
    }

    // Create new user with pending status
    const newUser = await User.create({
      name,
      email,
      password,
      phone,
      education,
      institution,
      location,
      status: 'pending'
    });

    res.status(201).json({
      status: 'success',
      message: 'Registration successful. Please wait for admin approval.',
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        status: newUser.status
      }
    });
  } catch (error) {
    next(error);
  }
};

// Login user
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Check if email and password exist
    if (!email || !password) {
      throw new AppError('Please provide email and password', 400);
    }

    // Find user and include password
    const user = await User.findOne({ email }).select('+password');
    
    if (!user || !(await user.correctPassword(password, user.password))) {
      throw new AppError('Incorrect email or password', 401);
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    // Create token and send response
    createSendToken(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// Get current user
exports.getCurrentUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    
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

// Logout (client-side token removal)
exports.logout = (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Logged out successfully'
  });
};