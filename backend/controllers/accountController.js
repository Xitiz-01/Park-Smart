const User = require('../models/User');
const VendorProfile = require('../models/VendorProfile');
const { updateCurrentAuthUser } = require('../auth/betterAuthBridge');

const publicUser = (user) => ({
  _id: user._id,
  authUserId: user.authUserId,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  isActive: user.isActive,
});

const getVendorProfile = (userId) => VendorProfile.findOne({ userId });

const getProfile = async (req, res) => {
  try {
    const [user, vendorProfile] = await Promise.all([
      User.findById(req.user._id),
      getVendorProfile(req.user._id),
    ]);
    res.json({ success: true, user: publicUser(user), vendorProfile });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Unable to load account profile' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Name and phone are required' });
    }

    await updateCurrentAuthUser({ headers: req.headers, data: { name, phone } });
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, phone },
      { new: true, runValidators: true }
    );
    return res.json({ success: true, user: publicUser(user) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to update account profile' });
  }
};

module.exports = { getProfile, updateProfile, publicUser };
