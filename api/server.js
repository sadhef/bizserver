const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const User = require('./models/User');
const Progress = require('./models/Progress');
require('dotenv').config();

// Set mongoose strictQuery to true
mongoose.set('strictQuery', true);

const app = express();

// MongoDB Connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://muhammedsadhef:RIFA123456@cluster0.7xpiu.mongodb.net/ctf_db', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('MongoDB Connected Successfully');
  } catch (err) {
    console.error('MongoDB Connection Error:', err);
    process.exit(1);
  }
};

// Connect to MongoDB
connectDB();

// CORS Config
app.use(cors({
  origin: ['http://localhost:3000', 'https://bizclient12.vercel.app'],
  methods: ['GET', 'POST', 'DELETE', 'PUT', 'OPTIONS'], // Add OPTIONS
  allowedHeaders: ['Content-Type', 'Authorization'], // Allow Authorization
  credentials: true
}));

app.options('*', cors());

app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Get all registrations
app.get('/api/register', async (req, res) => {
  try {
    const users = await User.find().lean();
    res.json(users);
  } catch (error) {
    console.error('Get registrations error:', error);
    res.status(500).json({ message: 'Error fetching registrations' });
  }
});

// Get all progress
app.get('/api/get-progress', async (req, res) => {
  try {
    const progress = await Progress.find().lean();
    res.json(progress);
  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({ message: 'Error fetching progress' });
  }
});

// Registration endpoint
app.post('/api/register', async (req, res) => {
  try {
    const { email, name, institution, phone } = req.body;

    if (!email || !name || !institution) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const userData = {
      name,
      email,
      institution,
      phone,
      registrationTime: new Date(),
      startTime: new Date()
    };

    const user = await User.create(userData);

    const progressData = {
      userEmail: email,
      userName: name,
      startTime: new Date(),
      timeRemaining: 3600,
      currentLevel: 1,
      levelStatus: { 1: false, 2: false, 3: false, 4: false },
      flagsEntered: {},
      attemptCounts: { 1: 0, 2: 0, 3: 0, 4: 0 },
      hintUsed: { 1: false, 2: false, 3: false, 4: false }
    };

    await Progress.create(progressData);

    res.status(201).json({
      message: 'Registration successful',
      userEmail: email,
      userName: name
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/get-time/:email', async (req, res) => {
    try {
      const { email } = req.params;
      let progress = await Progress.findOne({ userEmail: email }).lean();
      
      if (!progress) {
        const user = await User.findOne({ email }).lean();
        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }
        
        // Create new progress for user
        progress = await Progress.create({
          userEmail: email,
          userName: user.name,
          startTime: new Date(),
          timeRemaining: 3600,
          currentLevel: 1
        });
        
        return res.json({ timeRemaining: 3600 });
      }
  
      const startTime = new Date(progress.startTime);
      const now = new Date();
      const elapsedSeconds = Math.floor((now - startTime) / 1000);
      const timeRemaining = Math.max(3600 - elapsedSeconds, 0);
  
      // Update progress with new time
      await Progress.updateOne(
        { userEmail: email },
        { $set: { timeRemaining, lastUpdated: now } }
      );
  
      res.json({ 
        timeRemaining,
        startTime: startTime.toISOString(),
        serverTime: now.toISOString()
      });
    } catch (error) {
      console.error('Get time error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

// Save progress endpoint
app.post('/api/save-progress', async (req, res) => {
  try {
    const { 
      userEmail, 
      currentLevel, 
      timeRemaining,
      flagsEntered,
      attemptCounts,
      hintUsed,
      completed,
      levelStatus 
    } = req.body;
    
    if (!userEmail) {
      return res.status(400).json({ message: 'User email is required' });
    }

    const updateData = {
      lastUpdated: new Date()
    };

    if (currentLevel) updateData.currentLevel = currentLevel;
    if (timeRemaining !== undefined) updateData.timeRemaining = timeRemaining;
    if (flagsEntered) updateData.flagsEntered = flagsEntered;
    if (attemptCounts) updateData.attemptCounts = attemptCounts;
    if (hintUsed) updateData.hintUsed = hintUsed;
    if (levelStatus) updateData.levelStatus = levelStatus;
    if (completed !== undefined) updateData.completed = completed;

    const progress = await Progress.findOneAndUpdate(
      { userEmail },
      { $set: updateData },
      { new: true, upsert: true }
    ).lean();

    res.json({
      message: 'Progress saved successfully',
      progress
    });
  } catch (error) {
    console.error('Save progress error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete user endpoint
app.delete('/api/delete-user/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    const user = await User.findOneAndDelete({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await Progress.findOneAndDelete({ userEmail: email });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;