const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  phone: {
    type: String,
    default: ''
  },
  education: {
    type: String,
    default: ''
  },
  institution: {
    type: String,
    default: ''
  },
  location: {
    type: String,
    default: ''
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  isCloud: {
    type: Boolean, // Ensure this is defined as Boolean, not String
    default: false
  },
  registrationTime: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date
  }
});

// Create index for email
userSchema.index({ email: 1 }, { unique: true });

// Hash password before saving
userSchema.pre('save', async function(next) {
  // Only hash the password if it's modified (or new)
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    console.log('Hashing password for user:', this.email);
    // Generate salt
    const salt = await bcrypt.genSalt(10);
    // Hash password
    this.password = await bcrypt.hash(this.password, salt);
    console.log('Password hashed successfully');
    next();
  } catch (error) {
    console.error('Error hashing password:', error);
    next(error);
  }
});

// Convert string values to proper booleans before saving
userSchema.pre('save', function(next) {
  // Ensure isAdmin is always a boolean
  if (this.isAdmin === 'true' || this.isAdmin === '1' || this.isAdmin === 1) {
    this.isAdmin = true;
  } else if (this.isAdmin === 'false' || this.isAdmin === '0' || this.isAdmin === 0) {
    this.isAdmin = false;
  }
  
  // Ensure isCloud is always a boolean
  if (this.isCloud === 'true' || this.isCloud === '1' || this.isCloud === 1) {
    this.isCloud = true;
  } else if (this.isCloud === 'false' || this.isCloud === '0' || this.isCloud === 0) {
    this.isCloud = false;
  }
  
  console.log('Normalized user permissions:', {
    isAdmin: this.isAdmin,
    isCloud: this.isCloud
  });
  
  next();
});

// Method to compare password for login
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    console.error('Error comparing passwords:', error);
    throw error;
  }
};

// Create the model
const User = mongoose.model('User', userSchema);

// Export the model
module.exports = User;