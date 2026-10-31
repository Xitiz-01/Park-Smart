const path = require('path');
const VerificationDocument = require('../models/VerificationDocument');
const ParkingAuthorization = require('../models/ParkingAuthorization');
const ParkingLocation = require('../models/ParkingLocation');
const VendorVerification = require('../models/VendorVerification');
const { DOCUMENT_CATEGORIES, DOCUMENT_TYPES, AUTHORIZATION_DOCUMENT_TYPES } = require('../constants/verification');
const { createStorageService } = require('../services/storageService');
const {
  getVerificationSummary, getOrCreateVerification, recomputeVerification, audit,
} = require('../services/verificationService');
const { CashfreeVerificationProvider } = require('../services/verificationProviders');

const storage = createStorageService();
const extensionFor = (mime) => ({ 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' }[mime] || 'bin');
const safeFileName = (name) => path.basename(String(name || 'document')).replace(/[^a-z0-9._-]/gi, '_').slice(0, 120);
const categoryForType = (type) => {
  if (['PAN', 'DRIVING_LICENCE', 'OTHER_IDENTITY'].includes(type)) return 'IDENTITY';
  if (['GSTIN', 'CIN', 'BUSINESS_REGISTRATION'].includes(type)) return 'BUSINESS';
  if (['BANK_PROOF', 'CANCELLED_CHEQUE'].includes(type)) return 'BANK';
  return null;
};
const CASHFREE_CHECKS = ['PAN', 'GSTIN', 'BANK_ACCOUNT'];
const IDENTIFIER_RULES = {
  PAN: /^[A-Z]{5}[0-9]{4}[A-Z]$/,
  GSTIN: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
};
const providers = () => ({
  cashfree: new CashfreeVerificationProvider(),
});

const getMyVerification = async (req, res, next) => {
  try {
    const summary = await getVerificationSummary(req.vendorProfile._id);
    const configured = providers();
    res.json({
      success: true,
      ...summary,
      providerAvailability: {
        manual: true,
        cashfree: configured.cashfree.isConfigured(),
        cashfreeCapabilities: configured.cashfree.isConfigured() ? CASHFREE_CHECKS : [],
      },
    });
  } catch (error) { next(error); }
};

const submitManualDocument = async (req, res, next) => {
  try {
    const documentType = String(req.body.documentType || '').toUpperCase();
    const requestedCategory = String(req.body.category || '').toUpperCase();
    const category = categoryForType(documentType);
    if (!DOCUMENT_TYPES.includes(documentType) || !DOCUMENT_CATEGORIES.includes(requestedCategory) || category !== requestedCategory) {
      return res.status(400).json({ success: false, message: 'Document type does not match its verification category' });
    }
    if (String(req.body.consent) !== 'true') return res.status(400).json({ success: false, message: 'Consent is required before submitting identity evidence' });
    const previousVerification = await getOrCreateVerification(req.vendorProfile._id);
    const previousStatus = previousVerification.overallStatus;
    const storageKey = await storage.put(req.file.buffer, { extension: extensionFor(req.file.mimetype) });
    const document = await VerificationDocument.create({
      vendor: req.vendorProfile._id, category, documentType, provider: 'MANUAL', status: 'UNDER_REVIEW', storageKey,
      safeMetadata: { originalName: safeFileName(req.file.originalname), mimeType: req.file.mimetype, size: req.file.size },
    });
    const verification = previousVerification;
    verification.consents.push({ provider: 'MANUAL', source: 'VENDOR_UPLOAD', purpose: 'Vendor trust verification', scopes: [category] });
    await verification.save();
    await recomputeVerification(req.vendorProfile._id);
    await audit({ vendor: req.vendorProfile._id, action: 'DOCUMENT_SUBMITTED', previousStatus, newStatus: 'UNDER_REVIEW', provider: 'MANUAL', document: document._id });
    return res.status(201).json({ success: true, message: 'Document submitted for review', document });
  } catch (error) { return next(error); }
};

const submitParkingAuthorization = async (req, res, next) => {
  try {
    const documentType = String(req.body.documentType || '').toUpperCase();
    if (!AUTHORIZATION_DOCUMENT_TYPES.includes(documentType)) return res.status(400).json({ success: false, message: 'Select a valid authorization document type' });
    if (String(req.body.consent) !== 'true') return res.status(400).json({ success: false, message: 'Consent is required before submitting authorization evidence' });
    const location = await ParkingLocation.findOne({ _id: req.params.locationId, vendorId: req.vendorProfile._id });
    if (!location) return res.status(404).json({ success: false, message: 'Parking location not found' });
    const storageKey = await storage.put(req.file.buffer, { extension: extensionFor(req.file.mimetype) });
    const authorization = await ParkingAuthorization.create({
      vendor: req.vendorProfile._id, parkingLocation: location._id, documentType, status: 'UNDER_REVIEW', storageKey,
      safeMetadata: { originalName: safeFileName(req.file.originalname), mimeType: req.file.mimetype, size: req.file.size },
    });
    await audit({ vendor: req.vendorProfile._id, action: 'AUTHORIZATION_SUBMITTED', previousStatus: 'NOT_STARTED', newStatus: 'UNDER_REVIEW', provider: 'MANUAL', parkingAuthorization: authorization._id });
    return res.status(201).json({ success: true, message: 'Parking authorization submitted for review', authorization });
  } catch (error) { return next(error); }
};

const verifyWithCashfree = async (req, res, next) => {
  try {
    const kind = String(req.params.kind || '').toUpperCase();
    if (!CASHFREE_CHECKS.includes(kind)) return res.status(400).json({ success: false, message: 'Cashfree verification supports PAN, GSTIN and bank accounts' });
    if (req.body.consent !== true) return res.status(400).json({ success: false, message: 'Explicit Cashfree verification consent is required' });
    const suppliedName = String(req.body.name || req.body.businessName || '').trim();
    if (suppliedName.length < 2 || suppliedName.length > 160) return res.status(400).json({ success: false, message: 'Enter the name associated with this identifier' });
    const provider = providers().cashfree;
    let result;
    if (kind === 'BANK_ACCOUNT') {
      // Formats from Cashfree's Sync V2 request schema.
      const accountNumber = String(req.body.accountNumber || '').replace(/\s+/g, '');
      const ifsc = String(req.body.ifsc || '').trim().toUpperCase();
      if (!/^[A-Za-z0-9]{6,40}$/.test(accountNumber)) return res.status(400).json({ success: false, message: 'Enter a valid bank account number' });
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) return res.status(400).json({ success: false, message: 'Enter a valid IFSC' });
      if (!/^[A-Za-z0-9 .\-/&]+$/.test(suppliedName)) return res.status(400).json({ success: false, message: 'Enter the account holder name using letters, numbers, spaces and . - / &' });
      result = await provider.verifyBankAccount({ accountNumber, ifsc, name: suppliedName });
    } else {
      const identifier = String(req.body.identifier || '').trim().toUpperCase();
      if (!IDENTIFIER_RULES[kind].test(identifier)) return res.status(400).json({ success: false, message: `Enter a valid ${kind}` });
      result = kind === 'PAN'
        ? await provider.verifyPan({ identifier, name: suppliedName.slice(0, 120) })
        : await provider.verifyGstin({ identifier, businessName: suppliedName });
    }
    const document = await VerificationDocument.create({ vendor: req.vendorProfile._id, ...result, submittedAt: new Date(), verifiedAt: result.status === 'VERIFIED' ? new Date() : undefined });
    const verification = await getOrCreateVerification(req.vendorProfile._id);
    verification.consents.push({ provider: 'CASHFREE', source: 'VENDOR_FORM', purpose: `Verify ${kind}`, scopes: [kind] });
    await verification.save();
    await recomputeVerification(req.vendorProfile._id);
    const action = { VERIFIED: 'PROVIDER_VERIFIED', REJECTED: 'PROVIDER_FAILED' }[result.status] || 'DOCUMENT_SUBMITTED';
    await audit({ vendor: req.vendorProfile._id, action, previousStatus: 'NOT_STARTED', newStatus: result.status, provider: 'CASHFREE', document: document._id });
    return res.status(201).json({ success: true, result: document });
  } catch (error) { return next(error); }
};

module.exports = {
  getMyVerification,
  submitManualDocument,
  submitParkingAuthorization,
  verifyWithCashfree,
};
