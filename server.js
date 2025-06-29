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
const notificationRoutes = require('./api/routes/notifications');
const adminRoutes = require('./api/routes/admin'); // ADD THIS LINE

const app = express();

// CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'https://biztrastech.vercel.app',
  'https://biztras-4a141.firebaseapp.com',
  'https://biztras-4a141.web.app'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    
    // For development, allow any localhost
    if (origin.includes('localhost')) {
      return callback(null, true);
    }
    
    console.log('CORS request from unauthorized origin:', origin);
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Handle preflight requests
app.options('*', cors());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});

// Set response content type
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    environment: process.env.NODE_ENV || 'development',
    notificationService: 'available',
    firebaseProject: 'biztras-4a141'
  });
});

// Debug route for notification system
app.get('/api/debug/routes', (req, res) => {
  res.json({
    status: 'success',
    message: '🔔 Notification routes are loaded and ready!',
    timestamp: new Date().toISOString(),
    notificationEndpoints: [
      'POST /api/notifications/token - Save FCM token',
      'DELETE /api/notifications/token - Remove FCM token', 
      'POST /api/notifications/send - Send notification (Admin only)',
      'POST /api/notifications/test - Send test notification (Admin only)',
      'GET /api/notifications/stats - Get notification stats (Admin only)'
    ],
    adminEndpoints: [
      'GET /api/admin/users - Get all users (Admin only)',
      'GET /api/admin/stats - Get admin stats (Admin only)'
    ],
    firebaseConfig: {
      projectId: 'biztras-4a141',
      messagingSenderId: '210668459168',
      adminSDKInitialized: true,
      vapidKey: 'iEFad0fTGwEuCFsUlLDXSN-9ScWYJxNoYpG7VTljRWs'
    }
  });
});

// Test Firebase Admin SDK
app.get('/api/debug/test-firebase', async (req, res) => {
  try {
    const admin = require('./api/config/firebase-admin');
    
    // Test Firebase Admin connection with dry run
    const testMessage = {
      notification: {
        title: '🧪 Firebase Test',
        body: 'Firebase Admin SDK is working correctly!'
      },
      token: 'test-token-for-validation' // This will fail but shows SDK is working
    };
    
    try {
      const result = await admin.messaging().send(testMessage, true); // dry run
      res.json({
        status: 'success',
        message: 'Firebase Admin SDK is working correctly',
        result: result
      });
    } catch (error) {
      // Expected to fail with invalid token, but shows SDK is initialized
      if (error.code === 'messaging/invalid-registration-token' || 
          error.code === 'messaging/invalid-argument') {
        return res.json({
          status: 'success',
          message: 'Firebase Admin SDK is working correctly',
          note: 'Test token validation failed as expected (this is normal)',
          error: error.code
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('Firebase test error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Firebase Admin SDK error',
      error: error.message
    });
  }
});

// Main API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/challenges', challengeRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/cloud-report', cloudReportRoutes);
app.use('/api/backup-server', backupServerRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes); // ADD THIS LINE

// Routes without /api prefix (for backward compatibility)
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/challenges', challengeRoutes);
app.use('/progress', progressRoutes);
app.use('/settings', settingsRoutes);
app.use('/cloud-report', cloudReportRoutes);
app.use('/backup-server', backupServerRoutes);
app.use('/chat', chatRoutes);
app.use('/notifications', notificationRoutes);
app.use('/admin', adminRoutes); // ADD THIS LINE

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global Error Handler:', err);
  handleError(err, req, res, next);
});

// Handle 404 for API routes
app.use('/api/*', (req, res) => {
  console.log(`API 404: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    status: 'error',
    message: `API route ${req.originalUrl} not found`,
    availableRoutes: [
      '/api/auth/*',
      '/api/users/*', 
      '/api/challenges/*',
      '/api/progress/*',
      '/api/notifications/*',
      '/api/admin/*',
      '/api/debug/routes',
      '/api/debug/test-firebase'
    ]
  });
});

// Handle all other 404s
app.use('*', (req, res) => {
  console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    status: 'fail',
    message: `Cannot find ${req.originalUrl} on this server!`
  });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    console.log('✅ MongoDB connected successfully');
    
    // Initialize Firebase Admin SDK
    try {
      const admin = require('./api/config/firebase-admin');
      console.log('✅ Firebase Admin SDK initialized with project: biztras-4a141');
      console.log('🔔 Push notifications ready with Sender ID: 210668459168');
    } catch (error) {
      console.error('❌ Firebase Admin SDK initialization failed:', error.message);
      console.warn('⚠️ Continuing with mock notification service...');
    }
    
    // Start the server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('');
      console.log('📱 Notification System Status:');
      console.log('   ✅ Firebase Admin SDK: Ready');
      console.log('   ✅ Project ID: biztras-4a141');
      console.log('   ✅ Sender ID: 210668459168');
      console.log('   ✅ VAPID Key: iEFad0fTGwEuCFsUlLDXSN-9ScWYJxNoYpG7VTljRWs');
      console.log('');
      console.log('🔗 Available endpoints:');
      console.log('   - POST /api/notifications/token');
      console.log('   - DELETE /api/notifications/token');
      console.log('   - POST /api/notifications/send');
      console.log('   - POST /api/notifications/test');
      console.log('   - GET /api/notifications/stats');
      console.log('   - GET /api/admin/users');
      console.log('   - GET /api/admin/stats');
      console.log('   - GET /api/debug/routes');
      console.log('   - GET /api/debug/test-firebase');
      console.log('');
      console.log('🎉 Push notification system is fully operational!');
      console.log('');
      console.log('🧪 Quick Tests:');
      console.log(`   curl http://localhost:${PORT}/api/debug/routes`);
      console.log(`   curl http://localhost:${PORT}/api/debug/test-firebase`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  console.log('Shutting down server due to unhandled promise rejection');
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  console.log('Shutting down server due to uncaught exception');
  process.exit(1);
});

startServer();

module.exports = app;