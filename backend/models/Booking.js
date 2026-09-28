const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    slot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingSlot',
      default: null,
    },
    parkingLocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingLocation',
      default: null,
      index: true,
    },
    bookingType: {
      type: String,
      enum: ['regular', 'ev', 'legacy'],
      default: 'legacy',
    },
    vehicleType: {
      type: String,
      enum: ['car', 'bike', 'ev', 'motorcycle', 'suv'],
      default: 'car',
    },
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
    },
    expectedEndTime: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'cancelled', 'upcoming'],
      default: 'upcoming',
    },
    totalAmount: {
      type: Number,
      default: 0,
    },
    hourlyRate: { type: Number, min: 0, default: 0 },
    checkInTime: { type: Date, default: null },
    checkOutTime: { type: Date, default: null },
    reservationToken: { type: String, default: null, index: true },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'refunded'],
      default: 'pending',
    },
    paymentMethod: {
      type: String,
      enum: ['card', 'upi', 'netbanking', 'wallet'],
      default: null,
    },
    paymentReference: {
      type: String,
      default: null,
    },
    bookingCode: {
      type: String,
      unique: true,
    },
  },
  { timestamps: true }
);

// Generate unique booking code before save
bookingSchema.pre('save', function (next) {
  if (!this.bookingCode) {
    this.bookingCode = `PKG${new mongoose.Types.ObjectId().toString().slice(-10).toUpperCase()}`;
  }
  next();
});

bookingSchema.index({ parkingLocation: 1, startTime: 1, expectedEndTime: 1, status: 1 });
bookingSchema.index({ slot: 1, startTime: 1, expectedEndTime: 1, status: 1 });
bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ vehicle: 1, createdAt: -1 });
bookingSchema.index({ status: 1, startTime: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
