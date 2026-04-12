const Booking = require('../models/Booking');
const ParkingSlot = require('../models/ParkingSlot');
const Vehicle = require('../models/Vehicle');
const ALLOWED_PAYMENT_METHODS = ['card', 'upi', 'netbanking', 'wallet'];
const emitSlotUpdated = async (req, slotId) => {
  const io = req.app.get('io');
  if (!io) return;
  const slot = await ParkingSlot.findById(slotId).populate('currentBooking');
  if (slot) io.emit('slot:updated', slot);
};

// @desc    Create booking
// @route   POST /api/bookings
const createBooking = async (req, res) => {
  try {
    const { slotId, vehicleId, startTime, expectedEndTime, paymentMethod, paymentReference } = req.body;
    if (!paymentMethod || !ALLOWED_PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({ success: false, message: 'Valid payment method is required' });
    }

    const slot = await ParkingSlot.findById(slotId);
    if (!slot) return res.status(404).json({ success: false, message: 'Slot not found' });
    if (slot.status !== 'available') {
      return res.status(400).json({ success: false, message: 'Slot is not available' });
    }

    const vehicle = await Vehicle.findOne({ _id: vehicleId, user: req.user._id });
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });

    const start = new Date(startTime);
    const end = new Date(expectedEndTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return res.status(400).json({ success: false, message: 'Invalid booking times provided' });
    }
    const hours = Math.ceil((end - start) / (1000 * 60 * 60));
    const totalAmount = hours * slot.pricePerHour;

    const booking = await Booking.create({
      user: req.user._id,
      slot: slotId,
      vehicle: vehicleId,
      startTime: start,
      expectedEndTime: end,
      totalAmount,
      status: 'upcoming',
      paymentStatus: 'paid',
      paymentMethod,
      paymentReference: paymentReference || `PAY${Date.now().toString().slice(-10)}`,
    });

    // Update slot status
    slot.status = 'reserved';
    slot.currentBooking = booking._id;
    await slot.save();
    await emitSlotUpdated(req, slot._id);

    const populated = await booking.populate(['slot', 'vehicle']);
    res.status(201).json({ success: true, booking: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get my bookings
// @route   GET /api/bookings/my
const getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user._id })
      .populate('slot')
      .populate('vehicle')
      .sort({ createdAt: -1 });
    res.json({ success: true, bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get booking by ID
// @route   GET /api/bookings/:id
const getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('slot').populate('vehicle').populate('user', 'name email phone');
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    // Only owner or admin can see
    if (booking.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    res.json({ success: true, booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Cancel booking
// @route   PUT /api/bookings/:id/cancel
const cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (booking.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (booking.status === 'completed' || booking.status === 'cancelled') {
      return res.status(400).json({ success: false, message: `Booking is already ${booking.status}` });
    }

    booking.status = 'cancelled';
    await booking.save();

    // Free the slot
    await ParkingSlot.findByIdAndUpdate(booking.slot, { status: 'available', currentBooking: null });
    await emitSlotUpdated(req, booking.slot);

    res.json({ success: true, message: 'Booking cancelled successfully', booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Check in (Admin marks as active)
// @route   PUT /api/bookings/:id/checkin
const checkIn = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    booking.status = 'active';
    booking.startTime = new Date();
    await booking.save();

    await ParkingSlot.findByIdAndUpdate(booking.slot, { status: 'occupied' });
    await emitSlotUpdated(req, booking.slot);

    res.json({ success: true, message: 'Check-in successful', booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Check out (Admin marks as completed)
// @route   PUT /api/bookings/:id/checkout
const checkOut = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('slot');
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const endTime = new Date();
    const hours = Math.ceil((endTime - booking.startTime) / (1000 * 60 * 60));
    const totalAmount = hours * booking.slot.pricePerHour;

    booking.status = 'completed';
    booking.endTime = endTime;
    booking.totalAmount = totalAmount;
    booking.paymentStatus = 'paid';
    await booking.save();

    await ParkingSlot.findByIdAndUpdate(booking.slot._id, { status: 'available', currentBooking: null });
    await emitSlotUpdated(req, booking.slot._id);

    res.json({ success: true, message: 'Check-out successful', booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all bookings (Admin)
// @route   GET /api/bookings
const getAllBookings = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const bookings = await Booking.find(filter)
      .populate('slot')
      .populate('vehicle')
      .populate('user', 'name email phone')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Booking.countDocuments(filter);

    res.json({ success: true, bookings, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { createBooking, getMyBookings, getBookingById, cancelBooking, checkIn, checkOut, getAllBookings };
