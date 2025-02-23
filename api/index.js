const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// In-memory storage
let usersData = [];
let progressData = [];

// CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'https://bizclient12.vercel.app'],
  methods: ['GET', 'POST', 'DELETE', 'PUT'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));

app.use(express.json());

// Basic route
app.get('/api', (req, res) => {
  res.json({ message: 'API is working!' });
});

// Get time
app.get('/api/get-time/:email', (req, res) => {
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
});

// Get registrations
app.get('/api/get-registrations', (req, res) => {
  res.json(usersData);
});

// Get progress
app.get('/api/get-progress', (req, res) => {
  res.json(progressData);
});

// Register
app.post('/api/register', (req, res) => {
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
});

// Save progress
app.post('/api/save-progress', (req, res) => {
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
});

// Delete user
app.delete('/api/delete-user/:email', (req, res) => {
  const { email } = req.params;
  
  const userExists = usersData.some(user => user.email === email);
  if (!userExists) {
    return res.status(404).json({ message: 'User not found' });
  }

  usersData = usersData.filter(user => user.email !== email);
  progressData = progressData.filter(progress => progress.userEmail !== email);

  res.json({ message: 'User deleted successfully' });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

module.exports = app;