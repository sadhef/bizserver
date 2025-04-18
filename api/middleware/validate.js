/**
 * Validation middleware for request data
 * Helps ensure that incoming data meets expected formats
 */

const { AppError } = require('../../utils/errorHandler');

/**
 * Validate registration data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.validateRegistration = (req, res, next) => {
  try {
    const { name, email, password, phone, education, institution, location } = req.body;
    
    // Check required fields
    if (!name || !email || !password) {
      throw new AppError('Name, email, and password are required', 400);
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new AppError('Please provide a valid email address', 400);
    }
    
    // Validate password strength
    if (password.length < 6) {
      throw new AppError('Password must be at least 6 characters long', 400);
    }
    
    // Validate phone format if provided
    if (phone && !/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/.test(phone)) {
      throw new AppError('Please provide a valid phone number', 400);
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Validate login data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.validateLogin = (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    // Check required fields
    if (!email || !password) {
      throw new AppError('Email and password are required', 400);
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new AppError('Please provide a valid email address', 400);
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Validate challenge creation/update data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.validateChallenge = (req, res, next) => {
  try {
    const { levelNumber, title, description, hint, flag } = req.body;
    
    // Check required fields
    if (!levelNumber || !title || !description || !hint || !flag) {
      throw new AppError('Level number, title, description, hint, and flag are required', 400);
    }
    
    // Validate level number
    if (isNaN(parseInt(levelNumber)) || parseInt(levelNumber) < 1) {
      throw new AppError('Level number must be a positive integer', 400);
    }
    
    // Validate field lengths
    if (title.length < 3 || title.length > 100) {
      throw new AppError('Title must be between 3 and 100 characters', 400);
    }
    
    if (description.length < 10) {
      throw new AppError('Description must be at least 10 characters', 400);
    }
    
    if (hint.length < 5) {
      throw new AppError('Hint must be at least 5 characters', 400);
    }
    
    if (flag.length < 5) {
      throw new AppError('Flag must be at least 5 characters', 400);
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Validate flag submission
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.validateFlagSubmission = (req, res, next) => {
  try {
    const { flag } = req.body;
    
    // Check if flag exists
    if (!flag) {
      throw new AppError('Flag is required', 400);
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Validate MongoDB ID parameter
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.validateMongoId = (req, res, next) => {
  try {
    const id = req.params.id || req.params.userId;
    
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      throw new AppError('Invalid ID format', 400);
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Sanitize user input to prevent XSS attacks
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.sanitizeUserInput = (req, res, next) => {
  // Function to sanitize a string - basic implementation
  const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    
    // Replace potentially dangerous characters
    return str
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  };
  
  // Sanitize request body
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeString(req.body[key]);
      }
    });
  }
  
  // Sanitize request query parameters
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeString(req.query[key]);
      }
    });
  }
  
  next();
};