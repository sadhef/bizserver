module.exports = async (req, res) => {
    if (req.method !== 'DELETE') {
      return res.status(405).json({ message: 'Method Not Allowed' });
    }
  
    try {
      const email = req.query.email;
      
      if (!email) {
        return res.status(400).json({ message: 'Email parameter is required' });
      }
  
      // Check if user exists
      const userExists = global.usersData.some(user => user.email === email);
      if (!userExists) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      // Remove user from usersData
      global.usersData = global.usersData.filter(user => user.email !== email);
  
      // Remove user's progress
      global.progressData = global.progressData.filter(progress => progress.userEmail !== email);
  
      res.json({
        message: 'User deleted successfully',
        email,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };