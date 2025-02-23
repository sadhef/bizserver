const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// In-memory storage for Vercel serverless environment
let usersData = [];
let progressData = [];

// Enhanced CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'https://bizclient12.vercel.app'],
  methods: ['GET', 'POST', 'DELETE', 'PUT'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));

app.use(express.json());

// Error handling middleware
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get user's remaining time endpoint
app.get('/get-time/:email', asyncHandler(async (req, res) => {
  const { email } = req.params;
  const userProgress = progressData.find(p => p.userEmail === email);

  if (!userProgress) {
    const userData = usersData.find(u => u.email === email);
    if (!userData) {
      return res.status(404).json({ message: 'User not found' });
    }
    const startTime = new Date().toISOString();
    const newProgress = {
      userEmail: email,
      startTime,
      timeRemaining: 3600,
      currentLevel: 1,
      levelStatus: { 1: false, 2: false, 3: false, 4: false },
      flagsEntered: {},
      attemptCounts: { 1: 0, 2: 0, 3: 0, 4: 0 },
      hintUsed: { 1: false, 2: false, 3: false, 4: false }
    };
    progressData.push(newProgress);
    return res.json({ timeRemaining: 3600 });
  }

  const startTime = new Date(userProgress.startTime);
  const now = new Date();
  const elapsedSeconds = Math.floor((now - startTime) / 1000);
  const timeRemaining = Math.max(3600 - elapsedSeconds, 0);
  
  userProgress.timeRemaining = timeRemaining;
  res.json({ timeRemaining });
}));

// Get registrations endpoint
app.get('/get-registrations', (req, res) => {
  res.json(usersData);
});

// Get progress endpoint
app.get('/get-progress', (req, res) => {
  res.json(progressData);
});

// Registration endpoint
app.post('/register', asyncHandler(async (req, res) => {
  const newData = req.body;
  
  if (!newData.email || !newData.name || !newData.institution) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  const existingUser = usersData.find(user => user.email === newData.email);
  if (existingUser) {
    return res.status(400).json({ message: 'Email already registered' });
  }

  const userData = {
    ...newData,
    registrationTime: new Date().toISOString(),
    startTime: new Date().toISOString()
  };

  usersData.push(userData);

  // Initialize progress data
  const newProgress = {
    userEmail: newData.email,
    userName: newData.name,
    startTime: userData.startTime,
    timeRemaining: 3600,
    currentLevel: 1,
    levelStatus: { 1: false, 2: false, 3: false, 4: false },
    flagsEntered: {},
    attemptCounts: { 1: 0, 2: 0, 3: 0, 4: 0 },
    hintUsed: { 1: false, 2: false, 3: false, 4: false }
  };
  progressData.push(newProgress);

  res.status(201).json({
    message: 'Registration successful',
    userEmail: newData.email,
    userName: newData.name
  });
}));

// Save progress endpoint
app.post('/save-progress', asyncHandler(async (req, res) => {
  const { userEmail, ...progressUpdate } = req.body;
  
  if (!userEmail) {
    return res.status(400).json({ message: 'User email is required' });
  }

  const progressIndex = progressData.findIndex(p => p.userEmail === userEmail);
  if (progressIndex === -1) {
    progressData.push({
      userEmail,
      startTime: new Date().toISOString(),
      ...progressUpdate,
      lastUpdated: new Date().toISOString()
    });
  } else {
    progressData[progressIndex] = {
      ...progressData[progressIndex],
      ...progressUpdate,
      lastUpdated: new Date().toISOString()
    };
  }

  res.json({ message: 'Progress saved successfully' });
}));

// Delete user endpoint
app.delete('/delete-user/:email', asyncHandler(async (req, res) => {
  const { email } = req.params;
  
  const userExists = usersData.some(user => user.email === email);
  if (!userExists) {
    return res.status(404).json({ message: 'User not found' });
  }

  usersData = usersData.filter(user => user.email !== email);
  progressData = progressData.filter(progress => progress.userEmail !== email);

  res.json({ message: 'User deleted successfully' });
}));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Only start the server if not being imported
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('CORS enabled for:', ['http://localhost:3000', 'https://bizclient12.vercel.app']);
  });
}

module.exports = app;