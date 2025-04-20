const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Progress = require('../models/Progress');
const { AppError } = require('../../utils/errorHandler');

// Environment variables
const JWT_SECRET = process.env.JWT_SECRET || '9ffbc51e975aa664c84b7f583d9d3fe7863257f331814869a4ac867f520177e3617b50ffa7953640d383020440de5e22d0a7b3f08bebde1e3ca1fea7c7ceba15';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '2h';

// Helper function to ensure boolean values
const normalizeBoolean = (value) => {
  if (value === true || value === 'true' || value === 1 || value === '1') {
    return true;
  }
  return false;
};

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });
};

// User registration
exports.register = async (req, res, next) => {
  console.log('⭐️ Registration request received:', JSON.stringify(req.body));
  
  try {
    const { name, email, password, phone, education, institution, location } = req.body;
    
    // Validate required fields
    if (!name || !email || !password) {
      throw new AppError('Name, email, and password are required', 400);
    }
    
    console.log('📝 Checking if email already exists:', email);
    
    // Check if user exists with better error handling
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log('❌ Email already registered:', email);
      throw new AppError('Email already registered', 400);
    }
    
    console.log('✅ Email is available, creating new user');
    
    // Create new user with explicit try/catch
    let user;
    try {
      // Create user document
      user = new User({
        name,
        email,
        password,
        phone: phone || '',
        education: education || '',
        institution: institution || '',
        location: location || '',
        registrationTime: new Date(),
        isAdmin: false,
        isCloud: false // Explicitly set default values for permissions
      });
      
      // Save to database with explicit await
      await user.save();
      
      console.log('✅ User created successfully with ID:', user._id);
    } catch (createError) {
      console.error('❌ Error creating user:', createError);
      // Check for specific MongoDB errors
      if (createError.code === 11000) {
        throw new AppError('Email already registered', 400);
      }
      throw new AppError(`Failed to create user: ${createError.message}`, 500);
    }
    
    // Create initial progress for the user with the current time limit setting
    try {
      // Use the static method that gets time limit from settings
      const progress = await Progress.createWithTimeLimit(user._id);
      
      console.log('✅ Initial progress created for user:', user._id);
    } catch (progressError) {
      console.error('⚠️ Error creating initial progress:', progressError);
      // Don't fail registration if progress creation fails, but log it
      console.warn('User registered but progress not initialized');
    }
    
    // Generate token
    const token = generateToken(user._id);
    
    // Create safe user object without password
    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      education: user.education,
      institution: user.institution,
      location: user.location,
      isAdmin: false,
      isCloud: false,
      registrationTime: user.registrationTime
    };
    
    console.log('🎉 Registration successful for:', email);
    
    res.status(201).json({
      status: 'success',
      message: 'Registration successful',
      token,
      user: userResponse
    });
  } catch (error) {
    console.error('❌ Registration error:', error);
    next(error);
  }
};

// User login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    console.log('🔐 Login attempt for:', email);
    
    // Check if email and password exist
    if (!email || !password) {
      throw new AppError('Please provide email and password', 400);
    }
    
    // Find user and include password for comparison
    const user = await User.findOne({ email }).select('+password');
    
    // Check if user exists and password is correct
    if (!user) {
      console.log('❌ Login failed: User not found -', email);
      throw new AppError('Invalid email or password', 401);
    }
    
    // Compare password
    const isPasswordCorrect = await user.comparePassword(password);
    if (!isPasswordCorrect) {
      console.log('❌ Login failed: Invalid password for', email);
      throw new AppError('Invalid email or password', 401);
    }
    
    console.log('✅ Login successful for:', email);
    
    // Update last login timestamp
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });
    
    // Ensure user permissions are normalized to boolean
    const isAdminFlag = normalizeBoolean(user.isAdmin);
    const isCloudFlag = normalizeBoolean(user.isCloud);
    
    console.log('User permissions:', {
      isAdmin: isAdminFlag,
      isCloud: isCloudFlag,
      rawIsAdmin: user.isAdmin,
      rawIsCloud: user.isCloud
    });
    
    // Generate token
    const token = generateToken(user._id);
    
    // Create safe user object without password
    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      education: user.education,
      institution: user.institution,
      location: user.location,
      isAdmin: isAdminFlag,
      isCloud: isCloudFlag,
      registrationTime: user.registrationTime,
      lastLogin: user.lastLogin
    };
    
    res.status(200).json({
      status: 'success',
      token,
      user: userResponse
    });
  } catch (error) {
    console.error('❌ Login error:', error);
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
    
    // Ensure permissions are properly normalized
    const isAdminFlag = normalizeBoolean(user.isAdmin);
    const isCloudFlag = normalizeBoolean(user.isCloud);
    
    // Create response object with normalized values
    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      education: user.education,
      institution: user.institution,
      location: user.location,
      isAdmin: isAdminFlag,
      isCloud: isCloudFlag,
      registrationTime: user.registrationTime,
      lastLogin: user.lastLogin
    };
    
    res.status(200).json({
      status: 'success',
      user: userResponse
    });
  } catch (error) {
    next(error);
  }
};

// Admin login
exports.adminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    console.log('🔐 Admin login attempt for:', email);
    
    // Check if email and password exist
    if (!email || !password) {
      throw new AppError('Please provide email and password', 400);
    }
    
    // Find user and check if admin
    const user = await User.findOne({ email }).select('+password');
    
    // Check if user exists
    if (!user) {
      console.log('❌ Admin login failed: User not found -', email);
      throw new AppError('Invalid admin credentials', 401);
    }
    
    // Ensure admin flag is boolean
    const isAdminFlag = normalizeBoolean(user.isAdmin);
    
    // Check if user is admin
    if (!isAdminFlag) {
      console.log('❌ Admin login failed: User is not an admin -', email);
      throw new AppError('Invalid admin credentials', 401);
    }
    
    // Compare password
    const isPasswordCorrect = await user.comparePassword(password);
    if (!isPasswordCorrect) {
      console.log('❌ Admin login failed: Invalid password for', email);
      throw new AppError('Invalid admin credentials', 401);
    }
    
    console.log('✅ Admin login successful for:', email);
    
    // Update last login timestamp
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });
    
    // Also normalize cloud access flag
    const isCloudFlag = normalizeBoolean(user.isCloud);
    
    // Generate token
    const token = generateToken(user._id);
    
    // Create safe user object without password
    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      education: user.education,
      institution: user.institution,
      location: user.location,
      isAdmin: isAdminFlag,
      isCloud: isCloudFlag,
      registrationTime: user.registrationTime,
      lastLogin: user.lastLogin
    };
    
    res.status(200).json({
      status: 'success',
      token,
      user: userResponse
    });
  } catch (error) {
    console.error('❌ Admin login error:', error);
    next(error);
  }
};