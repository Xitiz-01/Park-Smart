const mongoose = require('mongoose');

const parkingSlotSchema = new mongoose.Schema(
  {
    slotNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    parkingLocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingLocation',
      default: null,
      index: true,
    },
    vehicleType: {
      type: String,
      enum: ['car', 'bike', 'ev', 'motorcycle', 'suv'],
      default: 'car',
    },
    floor: {
      type: String,
      required: false,
    },
    zone: {
      type: String,
      required: false,
      enum: ['A', 'B', 'C', 'D'],
    },
    type: {
      type: String,
      enum: ['standard', 'compact', 'disabled', 'ev'],
      default: 'standard',
    },
    evCompatible: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['available', 'occupied', 'reserved', 'maintenance'],
      default: 'available',
    },
    pricePerHour: {
      type: Number,
      required: true,
      default: 30,
    },
    currentBooking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
    },
    features: {
      hasCCTV: { type: Boolean, default: true },
      hasCover: { type: Boolean, default: false },
      hasEVCharger: { type: Boolean, default: false },
    },
    location: {
      lat: { type: Number, required: true, default: 28.6139 },
      lng: { type: Number, required: true, default: 77.2090 },
      label: { type: String, default: 'City Center' },
    },
  },
  { timestamps: true }
);

parkingSlotSchema.index(
  { parkingLocation: 1, slotNumber: 1 },
  { unique: true }
);

module.exports = mongoose.model('ParkingSlot', parkingSlotSchema);
