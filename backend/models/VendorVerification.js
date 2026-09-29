const mongoose = require('mongoose');
const { VERIFICATION_STATUSES, VERIFICATION_PROVIDERS } = require('../constants/verification');

const consentSchema = new mongoose.Schema({
  provider: { type: String, enum: VERIFICATION_PROVIDERS, required: true },
  source: { type: String, required: true, trim: true, maxlength: 80 },
  purpose: { type: String, required: true, trim: true, maxlength: 240 },
  scopes: [{ type: String, trim: true, maxlength: 80 }],
  recordedAt: { type: Date, default: Date.now },
}, { _id: true });

const vendorVerificationSchema = new mongoose.Schema({
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'VendorProfile', required: true, unique: true, index: true },
  overallStatus: { type: String, enum: VERIFICATION_STATUSES, default: 'NOT_STARTED', index: true },
  identityStatus: { type: String, enum: VERIFICATION_STATUSES, default: 'NOT_STARTED' },
  businessStatus: { type: String, enum: VERIFICATION_STATUSES, default: 'NOT_STARTED' },
  bankStatus: { type: String, enum: VERIFICATION_STATUSES, default: 'NOT_STARTED' },
  provider: { type: String, enum: VERIFICATION_PROVIDERS, default: 'MANUAL' },
  submittedAt: Date,
  reviewedAt: Date,
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectionReason: { type: String, trim: true, maxlength: 500 },
  resubmissionReason: { type: String, trim: true, maxlength: 500 },
  consents: [consentSchema],
}, { timestamps: true });

vendorVerificationSchema.virtual('payoutEligible').get(function payoutEligible() {
  return this.overallStatus === 'VERIFIED' && this.bankStatus === 'VERIFIED';
});
vendorVerificationSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('VendorVerification', vendorVerificationSchema);
