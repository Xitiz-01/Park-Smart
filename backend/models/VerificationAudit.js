const mongoose = require('mongoose');
const { VERIFICATION_PROVIDERS } = require('../constants/verification');

const verificationAuditSchema = new mongoose.Schema({
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'VendorProfile', required: true, index: true },
  action: {
    type: String,
    enum: [
      'DOCUMENT_SUBMITTED', 'AUTHORIZATION_SUBMITTED', 'VERIFICATION_STARTED',
      'PROVIDER_VERIFIED', 'PROVIDER_FAILED', 'ADMIN_APPROVED', 'ADMIN_REJECTED',
      'RESUBMISSION_REQUESTED', 'LOCATION_PUBLISHED', 'DOCUMENT_VIEWED',
    ],
    required: true,
    index: true,
  },
  previousStatus: String,
  newStatus: String,
  reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  provider: { type: String, enum: VERIFICATION_PROVIDERS },
  document: { type: mongoose.Schema.Types.ObjectId, ref: 'VerificationDocument' },
  parkingAuthorization: { type: mongoose.Schema.Types.ObjectId, ref: 'ParkingAuthorization' },
  note: { type: String, trim: true, maxlength: 500 },
}, { timestamps: true });

verificationAuditSchema.index({ vendor: 1, createdAt: -1 });

module.exports = mongoose.model('VerificationAudit', verificationAuditSchema);
