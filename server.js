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
const notificationRoutes = require('./api/routes/notifications'); // Add notification routes

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

// Request logging middleware with more details
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl} - Origin: ${req.headers.origin || 'none'}`);
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
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Debug middleware to log all routes
app.use((req, res, next) => {
  console.log(`🔍 Route Debug: ${req.method} ${req.path}`);
  next();
});

// API Routes with /api prefix (PRIMARY)
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/challenges', challengeRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/cloud-report', cloudReportRoutes);
app.use('/api/backup-server', backupServerRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/notifications', notificationRoutes); // Add notifications with /api prefix

// Routes without /api prefix (for compatibility)
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/challenges', challengeRoutes);
app.use('/progress', progressRoutes);
app.use('/settings', settingsRoutes);
app.use('/cloud-report', cloudReportRoutes);
app.use('/backup-server', backupServerRoutes);
app.use('/chat', chatRoutes);
app.use('/notifications', notificationRoutes); // Add notifications without /api prefix

// Test route to verify server is working
app.get('/test', (req, res) => {
  res.json({
    message: 'Server is working!',
    timestamp: new Date().toISOString()
  });
});

// List all registered routes (for debugging)
app.get('/routes', (req, res) => {
  const routes = [];
  
  app._router.stack.forEach((middleware) => {
    if (middleware.route) { // Simple route
      routes.push({
        method: Object.keys(middleware.route.methods)[0].toUpperCase(),
        path: middleware.route.path
      });
    } else if (middleware.name === 'router') { // Router middleware
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          const basePath = middleware.regexp.source.replace('\\/?', '').replace('(?=\\/|$)', '').replace('^', '');
          routes.push({
            method: Object.keys(handler.route.methods)[0].toUpperCase(),
            path: basePath + handler.route.path
          });
        }
      });
    }
  });
  
  res.json({
    message: 'Registered routes',
    routes: routes,
    total: routes.length
  });
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('🚨 Global Error Handler:', err);
  handleError(err, req, res, next);
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: `API route ${req.originalUrl} not found`
  });
});

// 404 Handler for undefined routes
app.use('*', (req, res) => {
  console.log(`🔍 404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    status: 'fail',
    message: `Cannot find ${req.originalUrl} on this server!`
  });
});

// Database Connection and Server Start
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    console.log('✅ MongoDB connected successfully');

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 Health check available at: http://localhost:${PORT}/health`);
      console.log(`🔧 Routes debug available at: http://localhost:${PORT}/routes`);
      console.log(`🧪 Test endpoint available at: http://localhost:${PORT}/test`);
      console.log(`📋 Available routes:`);
      console.log(`   🔐 Auth: POST /api/auth/login, POST /auth/login`);
      console.log(`   👥 Users: GET /api/users`);
      console.log(`   🔔 Notifications: POST /api/notifications/send`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('💥 Unhandled Rejection:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📴 SIGTERM received. Shutting down gracefully...');
  mongoose.connection.close(() => {
    console.log('📴 MongoDB connection closed.');
    process.exit(0);
  });
});

// Start the server
startServer();

module.exports = app;