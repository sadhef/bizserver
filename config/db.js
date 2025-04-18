const mongoose = require('mongoose');
require('dotenv').config();

// Get MongoDB URI from environment variables or use fallback
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://muhammedsadhef:RIFA123456@cluster0.7xpiu.mongodb.net/ctf_db';

// MongoDB connection options
const connectOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
};

// Connect to MongoDB with explicit connection monitoring
const connectDB = async () => {
  try {
    console.log('Attempting to connect to MongoDB at:', MONGODB_URI);
    
    // Create connection
    const conn = await mongoose.connect(MONGODB_URI, connectOptions);
    
    // Set up connection event listeners
    mongoose.connection.on('connected', () => {
      console.log('MongoDB connected successfully');
    });
    
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
    });
    
    // Handle process termination
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed due to app termination');
      process.exit(0);
    });
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    console.error('Full error stack:', error.stack);
    
    // Only exit in production
    if (process.env.NODE_ENV === 'production') {
      console.error('Exiting due to MongoDB connection failure');
      process.exit(1);
    }
    
    // Return error for handling
    return { error };
  }
};

// Export the connection function
module.exports = connectDB;