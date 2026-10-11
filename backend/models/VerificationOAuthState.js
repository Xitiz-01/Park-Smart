const mongoose = require('mongoose');

const verificationOAuthStateSchema = new mongoose.Schema({
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'VendorProfile', required: true, index: true },
  provider: { type: String, enum: ['DIGILOCKER'], required: true },
  stateHash: { type: String, required: true, unique: true, index: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  usedAt: Date,
}, { timestamps: true });

module.exports = mongoose.model('VerificationOAuthState', verificationOAuthStateSchema);
