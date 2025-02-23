const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const User = require('./models/User');
const Progress = require('./models/Progress');
require('dotenv').config();

mongoose.set('strictQuery', true);

const app = express();
const router = express.Router();

// 🔹 Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB Connected Successfully');
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err);
    process.exit(1);
  }
};

connectDB();

// 🔹 CORS Configuration (FIXED)
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'https://bizclient12.vercel.app',
    methods: ['GET', 'POST', 'DELETE', 'PUT', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// 🔹 Middleware for JSON Parsing
app.use(express.json());

// 🔹 Preflight Request Handling (FIXED)
app.options('*', cors());

// 🔹 Health Check Endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// 🔹 Get All Registrations
router.get('/get-registrations', async (req, res) => {
  try {
    const users = await User.find().lean();
    res.json(users);
  } catch (error) {
    console.error('❌ Get registrations error:', error);
    res.status(500).json({ message: 'Error fetching registrations' });
  }
});

// 🔹 Get All Progress
router.get('/get-progress', async (req, res) => {
  try {
    const progress = await Progress.find().lean();
    res.json(progress);
  } catch (error) {
    console.error('❌ Get progress error:', error);
    res.status(500).json({ message: 'Error fetching progress' });
  }
});

// 🔹 User Registration
router.post('/register', async (req, res) => {
  try {
    const { email, name, institution, phone } = req.body;

    if (!email || !name || !institution) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const user = await User.create({
      name,
      email,
      institution,
      phone,
      registrationTime: new Date(),
      startTime: new Date(),
    });

    await Progress.create({
      userEmail: email,
      userName: name,
      startTime: new Date(),
      timeRemaining: 3600,
      currentLevel: 1,
      levelStatus: { 1: false, 2: false, 3: false, 4: false },
      flagsEntered: {},
      attemptCounts: { 1: 0, 2: 0, 3: 0, 4: 0 },
      hintUsed: { 1: false, 2: false, 3: false, 4: false },
    });

    res.status(201).json({
      message: '✅ Registration successful',
      userEmail: email,
      userName: name,
    });
  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 🔹 Get Time Remaining for User
router.get('/get-time/:email', async (req, res) => {
  try {
    const { email } = req.params;
    let progress = await Progress.findOne({ userEmail: email }).lean();

    if (!progress) {
      const user = await User.findOne({ email }).lean();
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      progress = await Progress.create({
        userEmail: email,
        userName: user.name,
        startTime: new Date(),
        timeRemaining: 3600,
        currentLevel: 1,
      });

      return res.json({ timeRemaining: 3600 });
    }

    const elapsedSeconds = Math.floor((Date.now() - new Date(progress.startTime)) / 1000);
    const timeRemaining = Math.max(3600 - elapsedSeconds, 0);

    await Progress.updateOne({ userEmail: email }, { $set: { timeRemaining, lastUpdated: new Date() } });

    res.json({ 
      timeRemaining, 
      startTime: progress.startTime.toISOString(),
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Get time error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 🔹 Save Progress
router.post('/save-progress', async (req, res) => {
  try {
    const { userEmail, currentLevel, timeRemaining, flagsEntered, attemptCounts, hintUsed, completed, levelStatus } = req.body;

    if (!userEmail) {
      return res.status(400).json({ message: 'User email is required' });
    }

    const updateData = { lastUpdated: new Date() };
    if (currentLevel) updateData.currentLevel = currentLevel;
    if (timeRemaining !== undefined) updateData.timeRemaining = timeRemaining;
    if (flagsEntered) updateData.flagsEntered = flagsEntered;
    if (attemptCounts) updateData.attemptCounts = attemptCounts;
    if (hintUsed) updateData.hintUsed = hintUsed;
    if (levelStatus) updateData.levelStatus = levelStatus;
    if (completed !== undefined) updateData.completed = completed;

    const progress = await Progress.findOneAndUpdate({ userEmail }, { $set: updateData }, { new: true, upsert: true }).lean();

    res.json({ message: '✅ Progress saved successfully', progress });
  } catch (error) {
    console.error('❌ Save progress error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 🔹 Delete User
router.delete('/delete-user/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    const user = await User.findOneAndDelete({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await Progress.findOneAndDelete({ userEmail: email });

    res.json({ message: '✅ User deleted successfully' });
  } catch (error) {
    console.error('❌ Delete user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 🔹 Apply "/api" prefix to all routes
app.use('/api', router);

// 🔹 Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = app;
