const mongoose = require('mongoose');

// Database connection configuration
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      family: 4 // Use IPv4, skip trying IPv6
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected');
    });

    return conn;
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = () => {
  mongoose.connection.close(() => {
    console.log('🔒 MongoDB connection closed through app termination');
    process.exit(0);
  });
};

// Listen for termination signals
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Database utilities
const dbUtils = {
  // Check if database is connected
  isConnected: () => {
    return mongoose.connection.readyState === 1;
  },

  // Get database statistics
  getStats: async () => {
    try {
      const stats = await mongoose.connection.db.stats();
      return {
        database: mongoose.connection.name,
        collections: stats.collections,
        dataSize: stats.dataSize,
        indexSize: stats.indexSize,
        storageSize: stats.storageSize,
        objects: stats.objects
      };
    } catch (error) {
      console.error('Error getting database stats:', error);
      return null;
    }
  },

  // Clean up expired user sessions
  cleanupExpiredSessions: async () => {
    try {
      const User = require('../models/User');
      const now = new Date();
      
      const result = await User.updateMany(
        {
          challengeEndTime: { $lt: now },
          isActive: true
        },
        {
          isActive: false
        }
      );

      if (result.modifiedCount > 0) {
        console.log(`🧹 Cleaned up ${result.modifiedCount} expired user sessions`);
      }

      return result.modifiedCount;
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
      return 0;
    }
  },

  // Initialize default admin user
  initializeAdmin: async () => {
    try {
      const User = require('../models/User');
      const bcrypt = require('bcryptjs');

      // Check if any admin exists
      const adminExists = await User.findOne({ isAdmin: true });
      
      if (!adminExists) {
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@biztras.com';
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123456';
        const adminUsername = process.env.ADMIN_USERNAME || 'admin';

        const hashedPassword = await bcrypt.hash(adminPassword, 12);

        const admin = new User({
          username: adminUsername,
          email: adminEmail,
          password: hashedPassword,
          isAdmin: true,
          isApproved: true
        });

        await admin.save();
        console.log('👑 Default admin user created:', adminEmail);
        console.log('🔑 Default admin password:', adminPassword);
        console.log('⚠️ Please change the default password after first login!');
      }
    } catch (error) {
      console.error('Error initializing admin user:', error);
    }
  },

  // Initialize default configuration
  initializeConfig: async () => {
    try {
      const Config = require('../models/Config');
      
      let config = await Config.findOne();
      if (!config) {
        config = new Config({
          totalTimeLimit: 60,
          maxLevels: 2,
          challengeActive: false,
          registrationOpen: true,
          allowHints: true,
          maxAttempts: -1,
          challengeTitle: 'BizTras CTF Challenge',
          challengeDescription: 'Welcome to the BizTras Capture The Flag Challenge!',
          thankYouMessage: 'Thank you for participating in the BizTras CTF Challenge!'
        });
        
        await config.save();
        console.log('⚙️ Default configuration initialized');
      }
    } catch (error) {
      console.error('Error initializing configuration:', error);
    }
  },

  // Initialize sample challenges
  initializeSampleChallenges: async () => {
    try {
      const Challenge = require('../models/Challenge');
      
      const challengeCount = await Challenge.countDocuments();
      
      if (challengeCount === 0) {
        const sampleChallenges = [
          {
            level: 1,
            title: 'Welcome Challenge',
            description: 'Find the hidden flag in the source code of this page. Look for HTML comments!',
            hint: 'Check the page source for HTML comments',
            flag: 'BizTras{welcome_to_ctf}',
            difficulty: 'Easy',
            category: 'Web',
            points: 100
          },
          {
            level: 2,
            title: 'Basic Cryptography',
            description: 'Decode this Base64 encoded message: QmlkVHJhc3tkZWNvZGVfdGhpc30=',
            hint: 'This looks like Base64 encoding',
            flag: 'BizTras{decode_this}',
            difficulty: 'Easy',
            category: 'Crypto',
            points: 150
          }
        ];

        await Challenge.insertMany(sampleChallenges);
        console.log('🎯 Sample challenges initialized');
      }
    } catch (error) {
      console.error('Error initializing sample challenges:', error);
    }
  },

  // Database health check
  healthCheck: async () => {
    try {
      const isConnected = dbUtils.isConnected();
      
      if (!isConnected) {
        return {
          status: 'error',
          message: 'Database not connected',
          connected: false
        };
      }

      // Test a simple query
      await mongoose.connection.db.admin().ping();
      
      return {
        status: 'ok',
        message: 'Database is healthy',
        connected: true,
        readyState: mongoose.connection.readyState
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message,
        connected: false
      };
    }
  },

  // Create database indexes for better performance
  createIndexes: async () => {
    try {
      const User = require('../models/User');
      const Challenge = require('../models/Challenge');

      // Create indexes on User model
      await User.collection.createIndex({ email: 1 }, { unique: true });
      await User.collection.createIndex({ username: 1 }, { unique: true });
      await User.collection.createIndex({ isApproved: 1, isAdmin: 1 });
      await User.collection.createIndex({ challengeEndTime: 1 });
      await User.collection.createIndex({ isActive: 1 });
      await User.collection.createIndex({ createdAt: -1 });

      // Create indexes on Challenge model
      await Challenge.collection.createIndex({ level: 1 }, { unique: true });
      await Challenge.collection.createIndex({ isActive: 1 });
      await Challenge.collection.createIndex({ difficulty: 1 });
      await Challenge.collection.createIndex({ category: 1 });

      console.log('📊 Database indexes created successfully');
    } catch (error) {
      console.error('Error creating database indexes:', error);
    }
  },

  // Backup user data
  backupUserData: async () => {
    try {
      const User = require('../models/User');
      const fs = require('fs').promises;
      const path = require('path');

      const users = await User.find({ isAdmin: false }).select('-password');
      const backupData = {
        timestamp: new Date().toISOString(),
        userCount: users.length,
        users: users
      };

      const backupDir = path.join(__dirname, '..', 'backups');
      await fs.mkdir(backupDir, { recursive: true });

      const filename = `users_backup_${new Date().toISOString().split('T')[0]}.json`;
      const filepath = path.join(backupDir, filename);

      await fs.writeFile(filepath, JSON.stringify(backupData, null, 2));
      console.log(`💾 User data backed up to: ${filepath}`);

      return filepath;
    } catch (error) {
      console.error('Error backing up user data:', error);
      return null;
    }
  }
};

module.exports = {
  connectDB,
  dbUtils
};