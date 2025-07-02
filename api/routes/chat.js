const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { protect, restrictToAdmin } = require('../middleware/auth');

// Protect all routes in this router - require authentication
router.use(protect);

// Get messages
router.get('/messages', chatController.getMessages);

// Get new messages since a specific time
router.get('/messages/new', chatController.getNewMessages);

// Send a message
router.post('/messages', chatController.sendMessage);

// Get online users
router.get('/users/online', chatController.getOnlineUsers);

// Delete a message (admin only)
router.delete('/messages/:id', chatController.deleteMessage);

module.exports = router;