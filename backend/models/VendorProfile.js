const mongoose = require('mongoose');

const vendorProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    businessName: { type: String, required: true, trim: true, maxlength: 120 },
    businessType: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    address: { type: String, required: true, trim: true, maxlength: 250 },
    city: { type: String, required: true, trim: true, maxlength: 80 },
    state: { type: String, required: true, trim: true, maxlength: 80 },
    pincode: { type: String, required: true, trim: true, maxlength: 12 },
    verificationStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    vendorStatus: {
      type: String,
      enum: ['pending', 'active', 'rejected', 'suspended'],
      default: 'pending',
      index: true,
    },
    approvedAt: Date,
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectedAt: Date,
    suspendedAt: Date,
  },
  { timestamps: true }
);

vendorProfileSchema.index({ vendorStatus: 1, createdAt: -1 });

module.exports = mongoose.model('VendorProfile', vendorProfileSchema);
