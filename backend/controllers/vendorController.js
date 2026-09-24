const VendorProfile = require('../models/VendorProfile');

const PROFILE_FIELDS = ['businessName', 'businessType', 'phone', 'address', 'city', 'state', 'pincode'];

const pickProfileFields = (body) => PROFILE_FIELDS.reduce((result, field) => {
  if (body[field] !== undefined) result[field] = String(body[field]).trim();
  return result;
}, {});

const validateProfile = (profile, requireAll = true) => {
  const missing = PROFILE_FIELDS.filter((field) => requireAll && !profile[field]);
  if (missing.length) return `Missing required fields: ${missing.join(', ')}`;
  const empty = Object.entries(profile).find(([, value]) => !value);
  if (empty) return `${empty[0]} cannot be empty`;
  const limits = { businessName: 120, businessType: 80, phone: 30, address: 250, city: 80, state: 80, pincode: 12 };
  const tooLong = Object.entries(profile).find(([field, value]) => value.length > limits[field]);
  if (tooLong) return `${tooLong[0]} is too long`;
  if (profile.pincode !== undefined && !/^[A-Za-z0-9 -]{3,12}$/.test(profile.pincode)) {
    return 'Pincode must be between 3 and 12 letters or digits';
  }
  return null;
};

const registerVendor = async (req, res) => {
  try {
    if (req.user.role !== 'customer') {
      return res.status(403).json({ success: false, message: 'Only customer accounts can submit a vendor application' });
    }

    const existing = await VendorProfile.findOne({ userId: req.user._id });
    if (existing) {
      return res.status(409).json({ success: false, message: 'A vendor application already exists for this account' });
    }

    const data = pickProfileFields(req.body);
    const validationError = validateProfile(data);
    if (validationError) return res.status(400).json({ success: false, message: validationError });

    const vendorProfile = await VendorProfile.create({
      ...data,
      userId: req.user._id,
      verificationStatus: 'pending',
      vendorStatus: 'pending',
    });
    res.status(201).json({ success: true, message: 'Vendor application submitted', vendorProfile });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'A vendor application already exists for this account' });
    }
    res.status(500).json({ success: false, message: 'Unable to submit vendor application' });
  }
};

const getMyVendorProfile = async (req, res) => {
  try {
    const vendorProfile = await VendorProfile.findOne({ userId: req.user._id }).populate('approvedBy', 'name email');
    if (!vendorProfile) return res.status(404).json({ success: false, message: 'Vendor profile not found' });
    res.json({ success: true, vendorProfile });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Unable to load vendor profile' });
  }
};

const updateMyVendorProfile = async (req, res) => {
  try {
    const updates = pickProfileFields(req.body);
    if (!Object.keys(updates).length) {
      return res.status(400).json({ success: false, message: 'No editable profile fields were provided' });
    }
    const validationError = validateProfile(updates, false);
    if (validationError) return res.status(400).json({ success: false, message: validationError });

    const vendorProfile = await VendorProfile.findOneAndUpdate(
      { userId: req.user._id },
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!vendorProfile) return res.status(404).json({ success: false, message: 'Vendor profile not found' });
    res.json({ success: true, message: 'Vendor profile updated', vendorProfile });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Unable to update vendor profile' });
  }
};

const getVendorDashboard = async (req, res) => {
  res.json({
    success: true,
    stats: { parkingLocations: 0, activeBookings: 0, totalEarnings: 0 },
    vendorStatus: req.vendorProfile.vendorStatus,
  });
};

module.exports = { registerVendor, getMyVendorProfile, updateMyVendorProfile, getVendorDashboard };
