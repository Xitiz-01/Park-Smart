const path = require('path');
const VerificationDocument = require('../models/VerificationDocument');
const ParkingAuthorization = require('../models/ParkingAuthorization');
const ParkingLocation = require('../models/ParkingLocation');
const VendorVerification = require('../models/VendorVerification');
const VerificationOAuthState = require('../models/VerificationOAuthState');
const { DOCUMENT_CATEGORIES, DOCUMENT_TYPES, AUTHORIZATION_DOCUMENT_TYPES } = require('../constants/verification');
const { createStorageService } = require('../services/storageService');
const {
  getVerificationSummary, getOrCreateVerification, recomputeVerification, audit,
} = require('../services/verificationService');
const { CashfreeVerificationProvider, DigiLockerProvider } = require('../services/verificationProviders');

const storage = createStorageService();
const extensionFor = (mime) => ({ 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' }[mime] || 'bin');
const safeFileName = (name) => path.basename(String(name || 'document')).replace(/[^a-z0-9._-]/gi, '_').slice(0, 120);
const categoryForType = (type) => {
  if (['PAN', 'DRIVING_LICENCE', 'OTHER_IDENTITY'].includes(type)) return 'IDENTITY';
  if (['GSTIN', 'CIN', 'BUSINESS_REGISTRATION'].includes(type)) return 'BUSINESS';
  if (['BANK_PROOF', 'CANCELLED_CHEQUE'].includes(type)) return 'BANK';
  return null;
};
const providers = () => ({
  digilocker: new DigiLockerProvider(),
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
        digilocker: configured.digilocker.isConfigured(),
        cashfree: configured.cashfree.isConfigured(),
        cashfreeCapabilities: configured.cashfree.isConfigured() ? ['PAN', 'GSTIN'] : [],
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

const startDigiLocker = async (req, res, next) => {
  try {
    if (req.body.consent !== true) return res.status(400).json({ success: false, message: 'Explicit DigiLocker consent is required' });
    const provider = providers().digilocker;
    if (!provider.isConfigured()) return res.status(503).json({ success: false, code: 'PROVIDER_NOT_CONFIGURED', message: 'DigiLocker requester access is not configured' });
    const state = DigiLockerProvider.generateState();
    await VerificationOAuthState.create({ vendor: req.vendorProfile._id, provider: 'DIGILOCKER', stateHash: DigiLockerProvider.hashState(state), expiresAt: new Date(Date.now() + 10 * 60 * 1000) });
    const verification = await getOrCreateVerification(req.vendorProfile._id);
    verification.consents.push({ provider: 'DIGILOCKER', source: 'DIGILOCKER_OAUTH', purpose: 'Retrieve permitted verified vendor documents', scopes: ['IDENTITY', 'BUSINESS'] });
    await verification.save();
    await audit({ vendor: req.vendorProfile._id, action: 'VERIFICATION_STARTED', previousStatus: verification.overallStatus, newStatus: 'PENDING', provider: 'DIGILOCKER' });
    res.cookie('parksmart_digilocker_state', DigiLockerProvider.hashState(state), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 10 * 60 * 1000, path: '/api/vendor-verification/digilocker/callback' });
    return res.json({ success: true, authorizationUrl: provider.createAuthorizationUrl(state) });
  } catch (error) { return next(error); }
};

const parseCookies = (header = '') => Object.fromEntries(header.split(';').map((part) => part.trim().split('=')).filter(([key, value]) => key && value).map(([key, value]) => [key, decodeURIComponent(value)]));

const handleDigiLockerCallback = async (req, res, next) => {
  try {
    const stateHash = DigiLockerProvider.hashState(req.query.state || '');
    const cookieHash = parseCookies(req.headers.cookie).parksmart_digilocker_state;
    if (!req.query.state || !cookieHash || cookieHash !== stateHash) return res.status(400).json({ success: false, message: 'Invalid DigiLocker callback state' });
    const oauthState = await VerificationOAuthState.findOneAndUpdate(
      { stateHash, provider: 'DIGILOCKER', usedAt: null, expiresAt: { $gt: new Date() } },
      { $set: { usedAt: new Date() } },
      { new: true }
    );
    if (!oauthState) return res.status(400).json({ success: false, message: 'DigiLocker callback state is invalid, expired, or already used' });
    if (!req.query.code) return res.status(400).json({ success: false, message: 'DigiLocker did not return an authorization code' });
    const provider = providers().digilocker;
    const accessToken = await provider.exchangeCode(String(req.query.code));
    const normalizedDocuments = await provider.fetchDocuments(accessToken);
    for (const result of normalizedDocuments) {
      const document = await VerificationDocument.create({ vendor: oauthState.vendor, ...result, submittedAt: new Date(), verifiedAt: new Date() });
      await audit({ vendor: oauthState.vendor, action: 'PROVIDER_VERIFIED', previousStatus: 'PENDING', newStatus: 'VERIFIED', provider: 'DIGILOCKER', document: document._id });
    }
    await recomputeVerification(oauthState.vendor);
    res.clearCookie('parksmart_digilocker_state', { path: '/api/vendor-verification/digilocker/callback' });
    return res.redirect(`${process.env.CLIENT_URL || 'https://parksmart.live'}/vendor/verification?digilocker=success`);
  } catch (error) { return next(error); }
};

const verifyWithCashfree = async (req, res, next) => {
  try {
    const kind = String(req.params.kind || '').toUpperCase();
    if (!['PAN', 'GSTIN'].includes(kind)) return res.status(400).json({ success: false, message: 'Cashfree verification currently supports PAN and GSTIN' });
    if (req.body.consent !== true) return res.status(400).json({ success: false, message: 'Explicit Cashfree verification consent is required' });
    const identifier = String(req.body.identifier || '').trim().toUpperCase();
    const validIdentifier = kind === 'PAN'
      ? /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(identifier)
      : /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(identifier);
    if (!validIdentifier) return res.status(400).json({ success: false, message: `Enter a valid ${kind}` });
    const suppliedName = String(req.body.name || req.body.businessName || '').trim();
    if (suppliedName.length < 2 || suppliedName.length > 160) return res.status(400).json({ success: false, message: 'Enter the name associated with this identifier' });
    const provider = providers().cashfree;
    const result = kind === 'PAN'
      ? await provider.verifyPan({ identifier, name: suppliedName.slice(0, 120) })
      : await provider.verifyGstin({ identifier, businessName: suppliedName });
    const document = await VerificationDocument.create({ vendor: req.vendorProfile._id, ...result, submittedAt: new Date(), verifiedAt: result.status === 'VERIFIED' ? new Date() : undefined });
    const verification = await getOrCreateVerification(req.vendorProfile._id);
    verification.consents.push({ provider: 'CASHFREE', source: 'VENDOR_FORM', purpose: `Verify ${kind}`, scopes: [kind] });
    await verification.save();
    await recomputeVerification(req.vendorProfile._id);
    await audit({ vendor: req.vendorProfile._id, action: result.status === 'VERIFIED' ? 'PROVIDER_VERIFIED' : 'PROVIDER_FAILED', previousStatus: 'NOT_STARTED', newStatus: result.status, provider: 'CASHFREE', document: document._id });
    return res.status(201).json({ success: true, result: document });
  } catch (error) { return next(error); }
};

module.exports = {
  getMyVerification,
  submitManualDocument,
  submitParkingAuthorization,
  startDigiLocker,
  handleDigiLockerCallback,
  verifyWithCashfree,
};
