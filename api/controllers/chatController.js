const ChatMessage = require('../models/ChatMessage');
const User = require('../models/User');
const { AppError } = require('../../utils/errorHandler');

// Store active users - in a real app, use Redis or similar
const activeUsers = new Map();

// Helper: Update active user timestamp
const updateUserActivity = (userId) => {
  activeUsers.set(userId, {
    lastActive: new Date(),
    timeout: setTimeout(() => {
      // Remove user after 5 minutes of inactivity
      activeUsers.delete(userId);
    }, 5 * 60 * 1000)
  });
};

// Helper: Clean up user activity
const cleanupUserActivity = (userId) => {
  const userActivity = activeUsers.get(userId);
  if (userActivity && userActivity.timeout) {
    clearTimeout(userActivity.timeout);
  }
};

/**
 * Get recent chat messages
 * @route GET /api/chat/messages
 * @access Private
 */
exports.getMessages = async (req, res, next) => {
  try {
    // Update user activity
    updateUserActivity(req.user.id);
    
    // Get most recent messages (limit to 100)
    const messages = await ChatMessage.find()
      .sort({ createdAt: -1 })
      .limit(100);
    
    // Return in chronological order
    res.status(200).json({
      status: 'success',
      messages: messages.reverse()
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get new messages since a specific time
 * @route GET /api/chat/messages/new
 * @access Private
 */
exports.getNewMessages = async (req, res, next) => {
  try {
    // Update user activity
    updateUserActivity(req.user.id);
    
    // Get the 'since' timestamp from query
    const { since } = req.query;
    
    if (!since) {
      throw new AppError('Missing "since" timestamp parameter', 400);
    }
    
    // Get messages since the provided timestamp
    const messages = await ChatMessage.find({
      createdAt: { $gt: new Date(since) }
    }).sort({ createdAt: 1 });
    
    res.status(200).json({
      status: 'success',
      messages
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send a new chat message
 * @route POST /api/chat/messages
 * @access Private
 */
exports.sendMessage = async (req, res, next) => {
  try {
    // Update user activity
    updateUserActivity(req.user.id);
    
    const { text } = req.body;
    
    if (!text || !text.trim()) {
      throw new AppError('Message text is required', 400);
    }
    
    // Get user details
    const user = await User.findById(req.user.id);
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    // Create new message
    const message = await ChatMessage.create({
      userId: user._id,
      userName: user.name,
      text: text.trim(),
      createdAt: new Date()
    });
    
    res.status(201).json({
      status: 'success',
      message
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get online users
 * @route GET /api/chat/users/online
 * @access Private
 */
exports.getOnlineUsers = async (req, res, next) => {
  try {
    // Update user activity
    updateUserActivity(req.user.id);
    
    // Filter activeUsers by last activity (within 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    // Get active user IDs
    const activeUserIds = Array.from(activeUsers.entries())
      .filter(([_, data]) => data.lastActive > fiveMinutesAgo)
      .map(([id, _]) => id);
    
    // Find user details for active users
    const users = await User.find({
      _id: { $in: activeUserIds }
    }).select('_id name');
    
    res.status(200).json({
      status: 'success',
      users
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a chat message (admin only)
 * @route DELETE /api/chat/messages/:id
 * @access Private (Admin)
 */
exports.deleteMessage = async (req, res, next) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      throw new AppError('Only admins can delete messages', 403);
    }
    
    const messageId = req.params.id;
    
    if (!messageId) {
      throw new AppError('Message ID is required', 400);
    }
    
    // Delete the message
    const message = await ChatMessage.findByIdAndDelete(messageId);
    
    if (!message) {
      throw new AppError('Message not found', 404);
    }
    
    res.status(200).json({
      status: 'success',
      message: 'Message deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};