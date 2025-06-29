/**
 * Custom error class for application errors
 */
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global error handler middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const handleError = (err, req, res, next) => {
  // Ensure we have proper error structure
  let error = { ...err };
  error.message = err.message;
  
  console.log('Error handler received:', error.name, error.message);
  
  // Handle Mongoose validation errors
  if (error.name === 'ValidationError') {
    const messages = Object.values(error.errors).map(val => val.message);
    return res.status(400).json({
      status: 'fail',
      message: 'Validation Error',
      details: messages.join(', ')
    });
  }
  
  // Handle MongoDB duplicate key errors
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    return res.status(400).json({
      status: 'fail',
      message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists.`
    });
  }
  
  // Handle MongoDB connection errors
  if (error.name === 'MongoNetworkError' || error.name === 'MongoServerSelectionError') {
    return res.status(500).json({
      status: 'error',
      message: 'Database connection error. Please try again later.'
    });
  }
  
  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      status: 'fail',
      message: 'Invalid token. Please log in again.'
    });
  }
  
  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      status: 'fail',
      message: 'Your token has expired. Please log in again.'
    });
  }
  
  // Handle cast errors (e.g., invalid ObjectId)
  if (error.name === 'CastError') {
    return res.status(400).json({
      status: 'fail',
      message: `Invalid ${error.path}: ${error.value}`
    });
  }
  
  // Default handling for operational errors
  if (error.isOperational && error.statusCode) {
    return res.status(error.statusCode).json({
      status: error.status,
      message: error.message
    });
  }
  
  // For unexpected errors
  console.error('ERROR 💥:', error);
  
  // Ensure we have a valid status code
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Something went wrong';
  
  // Send error response
  return res.status(statusCode).json({
    status: statusCode >= 400 && statusCode < 500 ? 'fail' : 'error',
    message: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong. Please try again later.'
      : message,
    ...(process.env.NODE_ENV !== 'production' && { 
      error: error.toString(),
      stack: error.stack 
    })
  });
};

/**
 * Catch async errors for route handlers
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Express middleware function
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  AppError,
  handleError,
  catchAsync
};