const User = require('../models/User');
const Booking = require('../models/Booking');
const ParkingSlot = require('../models/ParkingSlot');
const VendorProfile = require('../models/VendorProfile');
const mongoose = require('mongoose');

// @desc    Get dashboard stats
// @route   GET /api/admin/dashboard
const getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: 'customer' });
    const totalSlots = await ParkingSlot.countDocuments();
    const availableSlots = await ParkingSlot.countDocuments({ status: 'available' });
    const occupiedSlots = await ParkingSlot.countDocuments({ status: 'occupied' });
    const reservedSlots = await ParkingSlot.countDocuments({ status: 'reserved' });
    const totalBookings = await Booking.countDocuments();
    const activeBookings = await Booking.countDocuments({ status: 'active' });
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayBookings = await Booking.countDocuments({ createdAt: { $gte: todayStart } });

    // Revenue
    const revenueResult = await Booking.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]);
    const totalRevenue = revenueResult[0]?.total || 0;

    const todayRevenueResult = await Booking.aggregate([
      { $match: { paymentStatus: 'paid', updatedAt: { $gte: todayStart } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]);
    const todayRevenue = todayRevenueResult[0]?.total || 0;

    // Recent bookings
    const recentBookings = await Booking.find()
      .populate('user', 'name email')
      .populate('slot', 'slotNumber zone')
      .populate('vehicle', 'licensePlate')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      success: true,
      stats: {
        users: { total: totalUsers },
        slots: { total: totalSlots, available: availableSlots, occupied: occupiedSlots, reserved: reservedSlots },
        bookings: { total: totalBookings, active: activeBookings, today: todayBookings },
        revenue: { total: totalRevenue, today: todayRevenue },
      },
      recentBookings,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all users
// @route   GET /api/admin/users
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ role: 'customer' }).sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Toggle user active status
// @route   PUT /api/admin/users/:id/toggle
const toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === 'admin') return res.status(400).json({ success: false, message: 'Cannot modify admin accounts' });

    user.isActive = !user.isActive;
    await user.save();
    res.json({ success: true, message: `User ${user.isActive ? 'activated' : 'deactivated'}`, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getVendors = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.vendorStatus = req.query.status;
    const vendors = await VendorProfile.find(filter)
      .populate('userId', 'name email phone role isActive')
      .populate('approvedBy', 'name email')
      .sort({ createdAt: -1 });
    res.json({ success: true, vendors });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Unable to load vendor applications' });
  }
};

const getVendorById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid vendor ID' });
    }
    const vendor = await VendorProfile.findById(req.params.id)
      .populate('userId', 'name email phone role isActive')
      .populate('approvedBy', 'name email');
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
    res.json({ success: true, vendor });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Unable to load vendor application' });
  }
};

const updateVendorStatus = async (req, res, action) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid vendor ID' });
    }
    const vendor = await VendorProfile.findById(req.params.id);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    const now = new Date();
    if (action === 'approve') {
      if (vendor.vendorStatus === 'active') {
        return res.status(409).json({ success: false, message: 'Vendor is already approved' });
      }
      const user = await User.findById(vendor.userId);
      if (!user) return res.status(404).json({ success: false, message: 'Vendor user account not found' });
      user.role = 'vendor';
      await user.save();
      vendor.verificationStatus = 'approved';
      vendor.vendorStatus = 'active';
      vendor.approvedAt = now;
      vendor.approvedBy = req.user._id;
      vendor.rejectedAt = undefined;
      vendor.suspendedAt = undefined;
      try {
        await vendor.save();
      } catch (error) {
        user.role = 'customer';
        await user.save();
        throw error;
      }
    } else {
      if (action === 'suspend' && vendor.vendorStatus !== 'active') {
        return res.status(409).json({ success: false, message: 'Only an active vendor can be suspended' });
      }
      const user = await User.findById(vendor.userId);
      if (user && user.role !== 'admin') {
        user.role = 'customer';
        await user.save();
      }
      if (action === 'reject') {
        vendor.verificationStatus = 'rejected';
        vendor.vendorStatus = 'rejected';
        vendor.rejectedAt = now;
        vendor.suspendedAt = undefined;
      } else {
        vendor.vendorStatus = 'suspended';
        vendor.suspendedAt = now;
      }
      await vendor.save();
    }

    const populated = await VendorProfile.findById(vendor._id)
      .populate('userId', 'name email phone role isActive')
      .populate('approvedBy', 'name email');
    const pastTense = { approve: 'approved', reject: 'rejected', suspend: 'suspended' }[action];
    res.json({ success: true, message: `Vendor ${pastTense} successfully`, vendor: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: `Unable to ${action} vendor` });
  }
};

const approveVendor = (req, res) => updateVendorStatus(req, res, 'approve');
const rejectVendor = (req, res) => updateVendorStatus(req, res, 'reject');
const suspendVendor = (req, res) => updateVendorStatus(req, res, 'suspend');

module.exports = {
  getDashboardStats,
  getAllUsers,
  toggleUserStatus,
  getVendors,
  getVendorById,
  approveVendor,
  rejectVendor,
  suspendVendor,
};
