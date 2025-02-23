const User = require('../models/User');
const Progress = require('../models/Progress');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { email, name, institution, phone } = req.body;

    if (!email || !name || !institution) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Create new user
    const user = await User.create({
      name,
      email,
      institution,
      phone,
      registrationTime: new Date(),
      startTime: new Date()
    });

    // Initialize progress
    const progress = await Progress.create({
      userEmail: email,
      userName: name,
      startTime: new Date(),
      timeRemaining: 3600,
      currentLevel: 1
    });

    res.status(201).json({
      message: 'Registration successful',
      userEmail: email,
      userName: name
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};