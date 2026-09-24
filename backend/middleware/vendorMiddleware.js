const VendorProfile = require('../models/VendorProfile');

const requireApprovedVendor = async (req, res, next) => {
  try {
    const vendorProfile = await VendorProfile.findOne({ userId: req.user._id });
    if (!vendorProfile || vendorProfile.verificationStatus !== 'approved' || vendorProfile.vendorStatus !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'An approved, active vendor account is required',
      });
    }
    req.vendorProfile = vendorProfile;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { requireApprovedVendor };
