const User = require('../models/User');
const Progress = require('../models/Progress');

module.exports = async (req, res) => {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ message: 'Email parameter is required' });
    }

    // Find and delete user
    const user = await User.findOneAndDelete({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete associated progress
    await Progress.findOneAndDelete({ userEmail: email });

    res.json({
      message: 'User deleted successfully',
      email,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};