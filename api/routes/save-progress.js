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
      const userExists = global.usersData.find(user => user.email === userEmail);
      if (!userExists) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      const progressIndex = global.progressData.findIndex(p => p.userEmail === userEmail);
      
      if (progressIndex === -1) {
        // Create new progress if not exists
        const newProgress = {
          userEmail,
          startTime: new Date().toISOString(),
          timeRemaining: progressUpdate.timeRemaining || 3600,
          currentLevel: progressUpdate.currentLevel || 1,
          levelStatus: progressUpdate.levelStatus || { 1: false, 2: false, 3: false, 4: false },
          flagsEntered: progressUpdate.flagsEntered || {},
          attemptCounts: progressUpdate.attemptCounts || { 1: 0, 2: 0, 3: 0, 4: 0 },
          hintUsed: progressUpdate.hintUsed || { 1: false, 2: false, 3: false, 4: false },
          lastUpdated: new Date().toISOString()
        };
        global.progressData.push(newProgress);
      } else {
        // Update existing progress
        global.progressData[progressIndex] = {
          ...global.progressData[progressIndex],
          ...progressUpdate,
          lastUpdated: new Date().toISOString()
        };
      }
  
      res.json({
        message: 'Progress saved successfully',
        userEmail,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Save progress error:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };