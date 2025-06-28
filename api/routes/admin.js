const express = require('express');
const router = express.Router();

// Try to import models and middleware with error handling
let User, Challenge, Progress, auth;

try {
  // Adjust these paths based on your actual project structure
  User = require('../models/User');
} catch (error) {
  console.warn('Warning: User model not found. Admin user features will be limited.');
}

try {
  Challenge = require('../models/Challenge');
} catch (error) {
  console.warn('Warning: Challenge model not found. Admin challenge features will be limited.');
}

try {
  Progress = require('../models/Progress');
} catch (error) {
  console.warn('Warning: Progress model not found. Admin progress features will be limited.');
}

try {
  auth = require('../middleware/auth');
} catch (error) {
  console.warn('Warning: Auth middleware not found. Using basic auth check.');
  // Fallback auth middleware
  auth = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }
    // Basic token validation - replace with your actual auth logic
    req.user = { role: 'admin', email: 'admin@example.com', _id: 'admin123' };
    next();
  };
}

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
  console.log('Checking admin access for user:', req.user?.email, 'Role:', req.user?.role);
  
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      message: 'Access denied. Admin privileges required.',
      userRole: req.user.role 
    });
  }
  
  next();
};

// Get all users
router.get('/users', auth, isAdmin, async (req, res) => {
  try {
    if (!User) {
      return res.status(500).json({ 
        message: 'User model not available',
        error: 'Database model not configured' 
      });
    }

    console.log('Fetching all users for admin dashboard');
    
    const users = await User.find({})
      .select('-password') // Exclude password field
      .sort({ createdAt: -1 });
    
    console.log(`Found ${users.length} users`);
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ 
      message: 'Server error while fetching users',
      error: error.message 
    });
  }
});

// Get all challenges
router.get('/challenges', auth, isAdmin, async (req, res) => {
  try {
    if (!Challenge) {
      return res.status(500).json({ 
        message: 'Challenge model not available',
        error: 'Database model not configured' 
      });
    }

    console.log('Fetching all challenges for admin dashboard');
    
    const challenges = await Challenge.find({})
      .sort({ level: 1 });
    
    console.log(`Found ${challenges.length} challenges`);
    res.json(challenges);
  } catch (error) {
    console.error('Error fetching challenges:', error);
    res.status(500).json({ 
      message: 'Server error while fetching challenges',
      error: error.message 
    });
  }
});

// Get all user progress
router.get('/progress', auth, isAdmin, async (req, res) => {
  try {
    if (!Progress) {
      return res.status(500).json({ 
        message: 'Progress model not available',
        error: 'Database model not configured' 
      });
    }

    console.log('Fetching all user progress for admin dashboard');
    
    const progress = await Progress.find({})
      .populate('user', 'name email')
      .populate('currentChallenge', 'title level')
      .sort({ updatedAt: -1 });
    
    console.log(`Found ${progress.length} progress records`);
    res.json(progress);
  } catch (error) {
    console.error('Error fetching progress:', error);
    res.status(500).json({ 
      message: 'Server error while fetching progress',
      error: error.message 
    });
  }
});

// Update user role
router.put('/users/:userId/role', auth, isAdmin, async (req, res) => {
  try {
    if (!User) {
      return res.status(500).json({ 
        message: 'User model not available',
        error: 'Database model not configured' 
      });
    }

    const { userId } = req.params;
    const { role } = req.body;

    console.log(`Admin ${req.user.email} attempting to change user ${userId} role to ${role}`);

    // Validate role
    const validRoles = ['user', 'admin', 'iscloud'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ 
        message: 'Invalid role specified',
        validRoles: validRoles 
      });
    }

    // Find and update user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent self role change to non-admin (safety check)
    if (userId === req.user._id.toString() && role !== 'admin') {
      return res.status(400).json({ 
        message: 'Cannot remove your own admin privileges' 
      });
    }

    const oldRole = user.role;
    user.role = role;
    await user.save();

    console.log(`Successfully changed user ${user.email} role from ${oldRole} to ${role}`);

    res.json({ 
      message: 'User role updated successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        previousRole: oldRole
      }
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ 
      message: 'Server error while updating user role',
      error: error.message 
    });
  }
});

// Delete user progress
router.delete('/progress/:progressId', auth, isAdmin, async (req, res) => {
  try {
    if (!Progress) {
      return res.status(500).json({ 
        message: 'Progress model not available',
        error: 'Database model not configured' 
      });
    }

    const { progressId } = req.params;

    console.log(`Admin ${req.user.email} attempting to delete progress ${progressId}`);

    const progress = await Progress.findById(progressId)
      .populate('user', 'name email');
      
    if (!progress) {
      return res.status(404).json({ message: 'Progress record not found' });
    }

    const userName = progress.user?.name || 'Unknown User';
    const userEmail = progress.user?.email || 'Unknown Email';

    await Progress.findByIdAndDelete(progressId);

    console.log(`Successfully deleted progress for user ${userName} (${userEmail})`);

    res.json({ 
      message: 'User progress deleted successfully',
      deletedProgress: {
        user: userName,
        email: userEmail,
        deletedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error deleting progress:', error);
    res.status(500).json({ 
      message: 'Server error while deleting progress',
      error: error.message 
    });
  }
});

// Get specific user details
router.get('/users/:userId', auth, isAdmin, async (req, res) => {
  try {
    if (!User) {
      return res.status(500).json({ 
        message: 'User model not available',
        error: 'Database model not configured' 
      });
    }

    const user = await User.findById(req.params.userId)
      .select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    console.log(`Fetched details for user: ${user.email}`);
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ 
      message: 'Server error while fetching user',
      error: error.message 
    });
  }
});

// Get specific challenge details
router.get('/challenges/:challengeId', auth, isAdmin, async (req, res) => {
  try {
    if (!Challenge) {
      return res.status(500).json({ 
        message: 'Challenge model not available',
        error: 'Database model not configured' 
      });
    }

    const challenge = await Challenge.findById(req.params.challengeId);
    
    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found' });
    }

    console.log(`Fetched challenge: ${challenge.title} (Level ${challenge.level})`);
    res.json(challenge);
  } catch (error) {
    console.error('Error fetching challenge:', error);
    res.status(500).json({ 
      message: 'Server error while fetching challenge',
      error: error.message 
    });
  }
});

// Get dashboard statistics
router.get('/stats', auth, isAdmin, async (req, res) => {
  try {
    console.log('Generating admin dashboard statistics');
    
    // Provide default stats if models aren't available
    if (!User || !Challenge || !Progress) {
      return res.json({
        users: { total: 0, byRole: [] },
        challenges: { total: 0, byDifficulty: [] },
        progress: { total: 0, byStatus: [] },
        generatedAt: new Date().toISOString(),
        note: 'Some models not available - showing default values'
      });
    }
    
    const [userCount, challengeCount, progressCount] = await Promise.all([
      User.countDocuments(),
      Challenge.countDocuments(),
      Progress.countDocuments()
    ]);

    const usersByRole = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);

    const challengesByDifficulty = await Challenge.aggregate([
      {
        $group: {
          _id: '$difficulty',
          count: { $sum: 1 }
        }
      }
    ]);

    const progressByStatus = await Progress.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const stats = {
      users: {
        total: userCount,
        byRole: usersByRole
      },
      challenges: {
        total: challengeCount,
        byDifficulty: challengesByDifficulty
      },
      progress: {
        total: progressCount,
        byStatus: progressByStatus
      },
      generatedAt: new Date().toISOString()
    };

    console.log('Dashboard statistics generated successfully');
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ 
      message: 'Server error while fetching statistics',
      error: error.message 
    });
  }
});

// Health check for admin routes
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    models: {
      User: !!User,
      Challenge: !!Challenge,
      Progress: !!Progress,
      Auth: !!auth
    }
  });
});

module.exports = router;