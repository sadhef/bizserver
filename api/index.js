const express = require('express');
const cors = require('cors');

// Import route handlers
const registerHandler = require('./routes/register');
const getTimeHandler = require('./routes/get-time');
const saveProgressHandler = require('./routes/save-progress');
const deleteUserHandler = require('./routes/delete-user');

const app = express();

// Initialize global storage
global.usersData = global.usersData || [];
global.progressData = global.progressData || [];

// CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'https://bizclient12.vercel.app'],
  methods: ['GET', 'POST', 'DELETE', 'PUT'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));

app.use(express.json());

// Basic route for testing
app.get('/api', (req, res) => {
  res.json({ 
    message: 'API is working!',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    users: global.usersData.length,
    progress: global.progressData.length
  });
});

// Route handlers
app.post('/api/register', registerHandler);
app.get('/api/get-time', getTimeHandler);
app.post('/api/save-progress', saveProgressHandler);
app.delete('/api/delete-user', deleteUserHandler);

// Get all registrations (admin only)
app.get('/api/registrations', (req, res) => {
  res.json(global.usersData);
});

// Get all progress (admin only)
app.get('/api/progress', (req, res) => {
  res.json(global.progressData);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Export the Express app
module.exports = app;