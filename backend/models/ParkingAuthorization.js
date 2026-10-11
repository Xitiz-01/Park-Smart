const mongoose = require('mongoose');
const { VERIFICATION_STATUSES, AUTHORIZATION_DOCUMENT_TYPES } = require('../constants/verification');

const parkingAuthorizationSchema = new mongoose.Schema({
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'VendorProfile', required: true, index: true },
  parkingLocation: { type: mongoose.Schema.Types.ObjectId, ref: 'ParkingLocation', required: true, index: true },
  documentType: { type: String, enum: AUTHORIZATION_DOCUMENT_TYPES, required: true },
  status: { type: String, enum: VERIFICATION_STATUSES, default: 'UNDER_REVIEW', index: true },
  storageKey: { type: String, required: true, select: false },
  safeMetadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  submittedAt: { type: Date, default: Date.now },
  reviewedAt: Date,
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectionReason: { type: String, trim: true, maxlength: 500 },
  resubmissionReason: { type: String, trim: true, maxlength: 500 },
}, { timestamps: true });

parkingAuthorizationSchema.index({ vendor: 1, parkingLocation: 1, createdAt: -1 });

module.exports = mongoose.model('ParkingAuthorization', parkingAuthorizationSchema);
