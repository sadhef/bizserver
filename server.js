// File: server.js (Updated with Todo Routes)
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { handleError } = require('./utils/errorHandler');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

// Import routes
const authRoutes = require('./api/routes/auth');
const userRoutes = require('./api/routes/users');
const challengeRoutes = require('./api/routes/challenges');
const progressRoutes = require('./api/routes/progress');
const settingsRoutes = require('./api/routes/settings');
const cloudReportRoutes = require('./api/routes/cloud-report');
const backupServerRoutes = require('./api/routes/backup-server');
const chatRoutes = require('./api/routes/chat');
// NEW: Todo and Notification routes
const todoRoutes = require('./api/routes/todos');
const notificationRoutes = require('./api/routes/notifications');

// Import notification service
const notificationService = require('./services/notificationService');

// Create Express app
const app = express();

// CORS Configuration - Allow both localhost and production URLs
const allowedOrigins = ['http://localhost:3000', 'https://biztrastech.vercel.app'];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      console.log('CORS request from unauthorized origin:', origin);
      return callback(null, true); // Still allow it - more permissive for development
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Middleware for JSON Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Handle preflight requests
app.options('*', cors());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});

// Add explicit CORS headers for all routes
app.use((req, res, next) => {
  const origin = req.headers.origin;
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

// Health Check Endpoint
app.get('/health', (req, res) => {
  const notificationStatus = notificationService.getStatus();
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    notificationService: notificationStatus
  });
});

// API Routes - both with and without /api prefix
// Routes with /api prefix
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/challenges', challengeRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/cloud-report', cloudReportRoutes); 
app.use('/api/backup-server', backupServerRoutes);
app.use('/api/chat', chatRoutes);
// NEW: Todo and Notification routes
app.use('/api/cloud/todos', todoRoutes);
app.use('/api/notifications', notificationRoutes);

// Routes without /api prefix (for compatibility)
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/challenges', challengeRoutes);
app.use('/progress', progressRoutes);
app.use('/settings', settingsRoutes);
app.use('/cloud-report', cloudReportRoutes);
app.use('/backup-server', backupServerRoutes);
app.use('/chat', chatRoutes);
// NEW: Todo and Notification routes without /api prefix
app.use('/cloud/todos', todoRoutes);
app.use('/notifications', notificationRoutes);

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  handleError(err, res);
});

// 404 Handler for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'fail',
    message: `Cannot find ${req.originalUrl} on this server!`
  });
});

// Graceful shutdown handler
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  notificationService.stopScheduledJobs();
  
  mongoose.connection.close(() => {
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  notificationService.stopScheduledJobs();
  
  mongoose.connection.close(() => {
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  });
});

// Connect to database and start server
const startServer = async () => {
  try {
    await connectDB();
    console.log('✅ MongoDB Connected Successfully');
    
    // Start notification service
    notificationService.startScheduledJobs();
    console.log('✅ Notification service started');
    
    // Start Server
    const PORT = process.env.PORT || 5000;
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Allowed CORS origins: ${allowedOrigins.join(', ')}`);
      console.log('✅ Todo system with push notifications ready!');
    });
    
    // Handle server shutdown
    server.on('close', () => {
      console.log('🛑 Server shutting down...');
      notificationService.stopScheduledJobs();
    });
    
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err);
    console.error('Starting server without database connection. Some features may not work.');
    
    // Start Server even if DB connection fails
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT} (without DB connection)`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('⚠️ Todo system disabled due to database connection failure');
    });
  }
};

// Start the server
startServer();

// Export for testing
module.exports = app;