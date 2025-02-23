const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const User = require('./models/User');
const Progress = require('./models/Progress');

const app = express();

// Connect to MongoDB
connectDB();

// CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'https://bizclient12.vercel.app'],
  methods: ['GET', 'POST', 'DELETE', 'PUT'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));

app.use(express.json());

// Import route handlers
const registerHandler = require('./routes/register');
const getTimeHandler = require('./routes/get-time');
const saveProgressHandler = require('./routes/save-progress');
const deleteUserHandler = require('./routes/delete-user');

// Basic route for testing
app.get('/api', (req, res) => {
  res.json({ 
    message: 'API is working!',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    const progressCount = await Progress.countDocuments();
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      users: userCount,
      progress: progressCount,
      database: 'connected'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Database connection error'
    });
  }
});

// Route handlers
app.post('/api/register', registerHandler);
app.get('/api/get-time', getTimeHandler);
app.post('/api/save-progress', saveProgressHandler);
app.delete('/api/delete-user', deleteUserHandler);

// Get all registrations (admin only)
app.get('/api/registrations', async (req, res) => {
  try {
    const users = await User.find().select('-__v');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users' });
  }
});

app.get('/api/check-env', (req, res) => {
    res.json({
      nodeEnv: process.env.NODE_ENV,
      corsOrigin: process.env.CORS_ORIGIN,
      mongodbConnected: !!mongoose.connection.readyState,
      timestamp: new Date().toISOString()
    });
  });

// Get all progress (admin only)
app.get('/api/progress', async (req, res) => {
  try {
    const progress = await Progress.find().select('-__v');
    res.json(progress);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching progress' });
  }
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