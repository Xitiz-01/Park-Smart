const jwt = require('jsonwebtoken');
const User = require('../models/User');
const VendorProfile = require('../models/VendorProfile');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });
};

const publicUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  isActive: user.isActive,
});

const getVendorProfile = (userId) => VendorProfile.findOne({ userId });

// @desc    Register customer
// @route   POST /api/auth/register
const registerUser = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (![name, email, password, phone].every((value) => typeof value === 'string' && value.trim())) {
      return res.status(400).json({ success: false, message: 'Name, email, password, and phone are required' });
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'A valid email address is required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const userExists = await User.findOne({ email: normalizedEmail });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const user = await User.create({
      name: name.trim(), email: normalizedEmail, password, phone: phone.trim(), role: 'customer',
    });

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token: generateToken(user._id),
      user: publicUser(user),
      vendorProfile: null,
    });
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ success: false, message: 'Email already registered' });
    res.status(500).json({ success: false, message: 'Unable to create account' });
  }
};

// @desc    Login user (customer or admin)
// @route   POST /api/auth/login
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account has been deactivated' });
    }

    const vendorProfile = await getVendorProfile(user._id);

    res.json({
      success: true,
      token: generateToken(user._id),
      user: publicUser(user),
      vendorProfile,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get logged in user profile
// @route   GET /api/auth/profile
const getProfile = async (req, res) => {
  try {
    const [user, vendorProfile] = await Promise.all([
      User.findById(req.user._id),
      getVendorProfile(req.user._id),
    ]);
    res.json({ success: true, user: publicUser(user), vendorProfile });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update profile
// @route   PUT /api/auth/profile
const updateProfile = async (req, res) => {
  try {
    const { name, phone } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, phone },
      { new: true, runValidators: true }
    );
    res.json({ success: true, user: publicUser(user) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    if (!(await user.matchPassword(currentPassword))) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { registerUser, loginUser, getProfile, updateProfile, changePassword };
