const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { handleError } = require('./utils/errorHandler');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

// Import ALL routes including notifications
const authRoutes = require('./api/routes/auth');
const userRoutes = require('./api/routes/users');
const challengeRoutes = require('./api/routes/challenges');
const progressRoutes = require('./api/routes/progress');
const settingsRoutes = require('./api/routes/settings');
const cloudReportRoutes = require('./api/routes/cloud-report');
const backupServerRoutes = require('./api/routes/backup-server');
const chatRoutes = require('./api/routes/chat');
const notificationRoutes = require('./api/routes/notifications'); // ← MAKE SURE THIS EXISTS

const app = express();

// CORS for production
const allowedOrigins = [
  'http://localhost:3000',
  'https://biztrastech.vercel.app',
  'https://biztras-4a141.firebaseapp.com' // Add Firebase domain
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      console.log('CORS request from unauthorized origin:', origin);
      return callback(null, true);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.options('*', cors());

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// API Routes - CRITICAL: Include notification routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/challenges', challengeRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/cloud-report', cloudReportRoutes);
app.use('/api/backup-server', backupServerRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/notifications', notificationRoutes); // ← CRITICAL: This line

// Routes without /api prefix (compatibility)
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/challenges', challengeRoutes);
app.use('/progress', progressRoutes);
app.use('/settings', settingsRoutes);
app.use('/cloud-report', cloudReportRoutes);
app.use('/backup-server', backupServerRoutes);
app.use('/chat', chatRoutes);
app.use('/notifications', notificationRoutes); // ← CRITICAL: This line too

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  handleError(err, req, res, next);
});

// 404 handler
app.use('*', (req, res) => {
  console.log('404 - Route not found:', req.method, req.originalUrl);
  res.status(404).json({
    status: 'fail',
    message: `Cannot find ${req.originalUrl} on this server!`
  });
});

// Start server
const PORT = process.env.PORT || 5000;
const startServer = async () => {
  try {
    await connectDB();
    console.log('MongoDB connected successfully');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log('Available routes:');
      console.log('- POST /api/notifications/token');
      console.log('- POST /api/notifications/send');
      console.log('- GET /api/notifications/stats');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
module.exports = app;