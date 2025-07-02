const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware for authentication
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ 
        error: 'Access token required',
        code: 'TOKEN_REQUIRED'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Update last activity
    user.lastActivity = new Date();
    await user.save();

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ 
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({ 
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    return res.status(500).json({ 
      error: 'Authentication server error',
      code: 'AUTH_SERVER_ERROR'
    });
  }
};

// Middleware for admin authentication
const authenticateAdmin = async (req, res, next) => {
  await authenticateToken(req, res, () => {
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({ 
        error: 'Admin access required',
        code: 'ADMIN_ACCESS_REQUIRED'
      });
    }
    next();
  });
};

// Middleware for approved user authentication
const authenticateApprovedUser = async (req, res, next) => {
  await authenticateToken(req, res, () => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    
    if (!req.user.isApproved && !req.user.isAdmin) {
      return res.status(403).json({ 
        error: 'Account pending approval',
        code: 'PENDING_APPROVAL'
      });
    }
    
    next();
  });
};

// Middleware to check if challenge is active
const checkChallengeActive = async (req, res, next) => {
  try {
    const Config = require('../models/Config');
    const config = await Config.getConfig();
    
    if (!config.isChallengeTimeActive()) {
      return res.status(403).json({ 
        error: 'Challenge is not currently active',
        code: 'CHALLENGE_INACTIVE',
        challengeActive: false
      });
    }
    
    req.config = config;
    next();
  } catch (error) {
    console.error('Challenge check error:', error);
    return res.status(500).json({ 
      error: 'Server error checking challenge status',
      code: 'CHALLENGE_CHECK_ERROR'
    });
  }
};

// Middleware to check if user's time hasn't expired
const checkTimeLimit = async (req, res, next) => {
  try {
    if (!req.user.challengeEndTime) {
      return next();
    }

    if (req.user.isTimeExpired() && req.user.isActive) {
      // Time expired, deactivate user
      req.user.isActive = false;
      await req.user.save();
      
      return res.status(410).json({ 
        error: 'Challenge time expired',
        code: 'TIME_EXPIRED',
        timeExpired: true
      });
    }
    
    next();
  } catch (error) {
    console.error('Time check error:', error);
    return res.status(500).json({ 
      error: 'Server error checking time limit',
      code: 'TIME_CHECK_ERROR'
    });
  }
};

// Rate limiting middleware for submissions
const rateLimitSubmissions = (req, res, next) => {
  const maxSubmissionsPerMinute = 10;
  const windowMs = 60 * 1000; // 1 minute
  
  if (!req.session) {
    req.session = {};
  }
  
  const now = Date.now();
  const windowStart = now - windowMs;
  
  if (!req.session.submissions) {
    req.session.submissions = [];
  }
  
  // Remove old submissions outside the window
  req.session.submissions = req.session.submissions.filter(
    timestamp => timestamp > windowStart
  );
  
  if (req.session.submissions.length >= maxSubmissionsPerMinute) {
    return res.status(429).json({ 
      error: 'Too many submission attempts. Please wait a moment.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil((req.session.submissions[0] + windowMs - now) / 1000)
    });
  }
  
  req.session.submissions.push(now);
  next();
};

// Validation middleware
const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        error: error.details[0].message,
        code: 'VALIDATION_ERROR'
      });
    }
    next();
  };
};

module.exports = {
  authenticateToken,
  authenticateAdmin,
  authenticateApprovedUser,
  checkChallengeActive,
  checkTimeLimit,
  rateLimitSubmissions,
  validateRequest
};