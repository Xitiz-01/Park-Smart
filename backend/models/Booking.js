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
      required: true,
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
    this.bookingCode = 'PKG' + Date.now().toString().slice(-8).toUpperCase();
  }
  next();
});

module.exports = mongoose.model('Booking', bookingSchema);
