const mongoose = require('mongoose');

const daySchema = new mongoose.Schema({
  open: { type: Boolean, default: true },
  allDay: { type: Boolean, default: false },
  openTime: { type: String, default: '06:00' },
  closeTime: { type: String, default: '23:00' },
}, { _id: false });

const addressSchema = new mongoose.Schema({
  formattedAddress: { type: String, required: true, trim: true },
  addressLine1: { type: String, required: true, trim: true },
  city: { type: String, required: true, trim: true },
  district: { type: String, trim: true },
  state: { type: String, required: true, trim: true },
  pincode: { type: String, required: true, trim: true },
  country: { type: String, default: 'India' },
  provider: { type: String, required: true },
  providerPlaceId: String,
  verified: { type: Boolean, default: true },
}, { _id: false });

const parkingLocationSchema = new mongoose.Schema({
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'VendorProfile', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 1000, default: '' },
  address: { type: addressSchema, required: true },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point', required: true },
    coordinates: {
      type: [Number], required: true,
      validate: { validator: (value) => value.length === 2, message: 'Coordinates must contain longitude and latitude' },
    },
  },
  vehicleTypes: [{ type: String, enum: ['car', 'bike', 'ev', 'motorcycle', 'suv'] }],
  evSupported: { type: Boolean, default: false },
  evDetails: {
    slotCount: { type: Number, min: 0, default: 0 },
    chargerType: { type: String, trim: true, maxlength: 80, default: '' },
  },
  operatingHours: {
    monday: { type: daySchema, default: () => ({}) },
    tuesday: { type: daySchema, default: () => ({}) },
    wednesday: { type: daySchema, default: () => ({}) },
    thursday: { type: daySchema, default: () => ({}) },
    friday: { type: daySchema, default: () => ({}) },
    saturday: { type: daySchema, default: () => ({}) },
    sunday: { type: daySchema, default: () => ({}) },
  },
  amenities: [{
    type: String,
    enum: ['covered', 'cctv', 'security_guard', 'ev_charging', 'accessible', '24_7_access'],
  }],
  pricing: {
    car: { type: Number, min: 0 },
    bike: { type: Number, min: 0 },
    ev: { type: Number, min: 0 },
    motorcycle: { type: Number, min: 0 },
    suv: { type: Number, min: 0 },
  },
  status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
}, { timestamps: true });

parkingLocationSchema.index({ location: '2dsphere' });
parkingLocationSchema.index({ vendorId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('ParkingLocation', parkingLocationSchema);
