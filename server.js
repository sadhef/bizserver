const express = require('express');
const fs = require('fs').promises;
const cors = require('cors');
const path = require('path');

const app = express();

// Enhanced CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'https://bizclient12.vercel.app'],
  methods: ['GET', 'POST', 'DELETE', 'PUT'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));

app.use(express.json());

// Data file paths
const DATA_DIR = path.join(__dirname, 'data');
const FILE_PATH_REG = path.join(DATA_DIR, 'registrations.json');
const FILE_PATH_PROGRESS = path.join(DATA_DIR, 'ctf_progress.json');

// Load data function with error handling
const loadData = async (filePath) => {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data || '[]');
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
};

// Save data function with error handling
const saveData = async (filePath, data) => {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
};

// Ensure data directory exists
const ensureDataDirectory = async () => {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
};

// Error handling middleware
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Get user's remaining time endpoint
app.get('/get-time/:email', asyncHandler(async (req, res) => {
  const { email } = req.params;
  const progressData = await loadData(FILE_PATH_PROGRESS);
  const userProgress = progressData.find(p => p.userEmail === email);

  if (!userProgress) {
    const userData = (await loadData(FILE_PATH_REG)).find(u => u.email === email);
    if (!userData) {
      return res.status(404).json({ message: 'User not found' });
    }
    // Initialize progress for new user
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
    await saveData(FILE_PATH_PROGRESS, progressData);
    return res.json({ timeRemaining: 3600 });
  }

  // Calculate remaining time
  const startTime = new Date(userProgress.startTime);
  const now = new Date();
  const elapsedSeconds = Math.floor((now - startTime) / 1000);
  const timeRemaining = Math.max(3600 - elapsedSeconds, 0);
  
  // Update progress with current time
  userProgress.timeRemaining = timeRemaining;
  await saveData(FILE_PATH_PROGRESS, progressData);

  res.json({ timeRemaining });
}));

// Get registrations endpoint
app.get('/get-registrations', asyncHandler(async (req, res) => {
  const data = await loadData(FILE_PATH_REG);
  res.json(data);
}));

// Get progress endpoint
app.get('/get-progress', asyncHandler(async (req, res) => {
  const data = await loadData(FILE_PATH_PROGRESS);
  res.json(data);
}));

// Registration endpoint
app.post('/register', asyncHandler(async (req, res) => {
  const newData = req.body;
  
  if (!newData.email || !newData.name || !newData.institution) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  const users = await loadData(FILE_PATH_REG);
  const existingUser = users.find(user => user.email === newData.email);

  if (existingUser) {
    return res.status(400).json({ message: 'Email already registered' });
  }

  const userData = {
    ...newData,
    registrationTime: new Date().toISOString(),
    startTime: new Date().toISOString()
  };

  users.push(userData);
  await saveData(FILE_PATH_REG, users);

  // Initialize progress data for new user
  const progressData = await loadData(FILE_PATH_PROGRESS);
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
  await saveData(FILE_PATH_PROGRESS, progressData);

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

  const progressData = await loadData(FILE_PATH_PROGRESS);
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

  await saveData(FILE_PATH_PROGRESS, progressData);
  res.json({ message: 'Progress saved successfully' });
}));

// Delete user endpoint
app.delete('/delete-user/:email', asyncHandler(async (req, res) => {
  const { email } = req.params;
  
  const users = await loadData(FILE_PATH_REG);
  const progressData = await loadData(FILE_PATH_PROGRESS);

  const userExists = users.some(user => user.email === email);
  if (!userExists) {
    return res.status(404).json({ message: 'User not found' });
  }

  const filteredUsers = users.filter(user => user.email !== email);
  const filteredProgress = progressData.filter(progress => progress.userEmail !== email);

  await Promise.all([
    saveData(FILE_PATH_REG, filteredUsers),
    saveData(FILE_PATH_PROGRESS, filteredProgress)
  ]);

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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await ensureDataDirectory();
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log('Data directory initialized');
      console.log('CORS enabled for:', ['http://localhost:3000', 'https://bizclient12.vercel.app']);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();