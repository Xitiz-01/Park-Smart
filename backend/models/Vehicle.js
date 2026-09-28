const mongoose = require('mongoose');
const { FUEL_TYPES } = require('../utils/vehicleClassification');

const vehicleSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    licensePlate: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    vehicleType: {
      type: String,
      // `ev` remains in the persisted enum until legacy records are migrated.
      enum: ['car', 'motorcycle', 'suv', 'ev'],
      default: 'car',
    },
    fuelType: {
      type: String,
      enum: FUEL_TYPES,
      default: null,
    },
    brand: { type: String, trim: true },
    model: { type: String, trim: true },
    color: { type: String, trim: true },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Vehicle', vehicleSchema);
