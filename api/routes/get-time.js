const User = require('../models/User');
const Progress = require('../models/Progress');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    let progress = await Progress.findOne({ userEmail: email });
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!progress) {
      // Initialize new progress if not exists
      progress = await Progress.create({
        userEmail: email,
        userName: user.name,
        startTime: user.startTime,
        timeRemaining: 3600
      });
      return res.json({ timeRemaining: 3600 });
    }

    // Calculate remaining time
    const startTime = new Date(progress.startTime);
    const now = new Date();
    const elapsedSeconds = Math.floor((now - startTime) / 1000);
    const timeRemaining = Math.max(3600 - elapsedSeconds, 0);

    // Update progress
    progress.timeRemaining = timeRemaining;
    await progress.save();

    res.json({ timeRemaining });
  } catch (error) {
    console.error('Get time error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};