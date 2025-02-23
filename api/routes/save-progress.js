const Progress = require('../models/Progress');
const User = require('../models/User');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { userEmail, ...progressUpdate } = req.body;
    
    if (!userEmail) {
      return res.status(400).json({ message: 'User email is required' });
    }

    // Check if user exists
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update or create progress
    let progress = await Progress.findOne({ userEmail });
    
    if (!progress) {
      progress = await Progress.create({
        userEmail,
        userName: user.name,
        ...progressUpdate,
        lastUpdated: new Date()
      });
    } else {
      Object.assign(progress, progressUpdate, { lastUpdated: new Date() });
      await progress.save();
    }

    res.json({
      message: 'Progress saved successfully',
      userEmail,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Save progress error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};