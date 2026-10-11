const mongoose = require('mongoose');
const {
  VERIFICATION_STATUSES, VERIFICATION_PROVIDERS, DOCUMENT_CATEGORIES, DOCUMENT_TYPES,
} = require('../constants/verification');

const verificationDocumentSchema = new mongoose.Schema({
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'VendorProfile', required: true, index: true },
  category: { type: String, enum: DOCUMENT_CATEGORIES, required: true, index: true },
  documentType: { type: String, enum: DOCUMENT_TYPES, required: true, index: true },
  provider: { type: String, enum: VERIFICATION_PROVIDERS, required: true },
  status: { type: String, enum: VERIFICATION_STATUSES, default: 'UNDER_REVIEW', index: true },
  storageKey: { type: String, select: false },
  providerReference: { type: String, trim: true, maxlength: 200 },
  safeMetadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  submittedAt: { type: Date, default: Date.now },
  verifiedAt: Date,
  reviewedAt: Date,
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectionReason: { type: String, trim: true, maxlength: 500 },
  resubmissionReason: { type: String, trim: true, maxlength: 500 },
}, { timestamps: true });

verificationDocumentSchema.index({ vendor: 1, category: 1, createdAt: -1 });

module.exports = mongoose.model('VerificationDocument', verificationDocumentSchema);
