module.exports = async (req, res) => {
    if (req.method !== 'GET') {
      return res.status(405).json({ message: 'Method Not Allowed' });
    }
  
    try {
      const email = req.query.email;
      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }
  
      const userProgress = global.progressData.find(p => p.userEmail === email);
  
      if (!userProgress) {
        const userData = global.usersData.find(u => u.email === email);
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
        global.progressData.push(newProgress);
        return res.json({ timeRemaining: 3600 });
      }
  
      const startTime = new Date(userProgress.startTime);
      const now = new Date();
      const elapsedSeconds = Math.floor((now - startTime) / 1000);
      const timeRemaining = Math.max(3600 - elapsedSeconds, 0);
      
      userProgress.timeRemaining = timeRemaining;
      res.json({ timeRemaining });
    } catch (error) {
      console.error('Get time error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };