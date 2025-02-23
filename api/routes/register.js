module.exports = async (req, res) => {
    if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Method Not Allowed' });
    }
  
    try {
      const newData = req.body;
      
      if (!newData.email || !newData.name || !newData.institution) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
  
      const existingUser = global.usersData.find(user => user.email === newData.email);
      if (existingUser) {
        return res.status(400).json({ message: 'Email already registered' });
      }
  
      const userData = {
        ...newData,
        registrationTime: new Date().toISOString(),
        startTime: new Date().toISOString()
      };
  
      global.usersData.push(userData);
  
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
      global.progressData.push(newProgress);
  
      res.status(201).json({
        message: 'Registration successful',
        userEmail: newData.email,
        userName: newData.name
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };