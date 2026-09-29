const mongoose = require('mongoose');
const VendorVerification = require('../models/VendorVerification');
const VerificationDocument = require('../models/VerificationDocument');
const ParkingAuthorization = require('../models/ParkingAuthorization');
const VendorProfile = require('../models/VendorProfile');
const { createStorageService } = require('../services/storageService');
const { getVerificationSummary, recomputeVerification, audit } = require('../services/verificationService');

const storage = createStorageService();

const listVerificationCases = async (req, res, next) => {
  try {
    const query = {};
    if (req.query.status) query.overallStatus = String(req.query.status).toUpperCase();
    if (req.query.type === 'document') query.vendor = { $in: await VerificationDocument.distinct('vendor') };
    if (req.query.type === 'authorization') query.vendor = { $in: await ParkingAuthorization.distinct('vendor') };
    const verifications = await VendorVerification.find(query)
      .populate({ path: 'vendor', select: 'businessName businessEmail userId', populate: { path: 'userId', select: 'name email' } })
      .sort({ updatedAt: -1 });
    const filtered = req.query.vendor
      ? verifications.filter((item) => `${item.vendor?.businessName || ''} ${item.vendor?.userId?.name || ''} ${item.vendor?.userId?.email || ''}`.toLowerCase().includes(String(req.query.vendor).toLowerCase()))
      : verifications;
    return res.json({ success: true, cases: filtered });
  } catch (error) { return next(error); }
};

const getVerificationCase = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.vendorId)) return res.status(400).json({ success: false, message: 'Invalid vendor ID' });
    const [summary, vendor] = await Promise.all([
      getVerificationSummary(req.params.vendorId),
      VendorProfile.findById(req.params.vendorId).populate('userId', 'name email phone'),
    ]);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
    return res.json({ success: true, vendor, ...summary });
  } catch (error) { return next(error); }
};

const getReviewTarget = async (type, id, includeStorage = false) => {
  if (!mongoose.isValidObjectId(id)) return null;
  const Model = type === 'document' ? VerificationDocument : type === 'authorization' ? ParkingAuthorization : null;
  if (!Model) return null;
  const query = Model.findById(id);
  if (includeStorage) query.select('+storageKey');
  return query;
};

const reviewEvidence = async (req, res, next) => {
  try {
    const action = String(req.params.action || '').toLowerCase();
    const transitions = { approve: 'VERIFIED', reject: 'REJECTED', resubmit: 'RESUBMISSION_REQUIRED' };
    if (!transitions[action]) return res.status(400).json({ success: false, message: 'Invalid review action' });
    const reason = String(req.body.reason || '').trim().slice(0, 500);
    if (action !== 'approve' && !reason) return res.status(400).json({ success: false, message: 'A reason is required' });
    const target = await getReviewTarget(req.params.type, req.params.id);
    if (!target) return res.status(404).json({ success: false, message: 'Verification evidence not found' });
    const previousStatus = target.status;
    target.status = transitions[action];
    target.reviewedAt = new Date();
    target.reviewedBy = req.user._id;
    target.verifiedAt = action === 'approve' ? new Date() : undefined;
    target.rejectionReason = action === 'reject' ? reason : undefined;
    target.resubmissionReason = action === 'resubmit' ? reason : undefined;
    await target.save();
    if (req.params.type === 'document') await recomputeVerification(target.vendor, { reviewer: req.user._id, rejectionReason: target.rejectionReason, resubmissionReason: target.resubmissionReason });
    await audit({
      vendor: target.vendor,
      action: action === 'approve' ? 'ADMIN_APPROVED' : action === 'reject' ? 'ADMIN_REJECTED' : 'RESUBMISSION_REQUESTED',
      previousStatus,
      newStatus: target.status,
      reviewer: req.user._id,
      provider: req.params.type === 'document' ? target.provider : 'MANUAL',
      document: req.params.type === 'document' ? target._id : undefined,
      parkingAuthorization: req.params.type === 'authorization' ? target._id : undefined,
      note: reason || undefined,
    });
    return res.json({ success: true, message: `Evidence marked ${target.status.toLowerCase().replaceAll('_', ' ')}`, evidence: target });
  } catch (error) { return next(error); }
};

const readEvidence = async (req, res, next) => {
  try {
    const target = await getReviewTarget(req.params.type, req.params.id, true);
    if (!target?.storageKey) return res.status(404).json({ success: false, message: 'Private document not found' });
    const content = await storage.read(target.storageKey);
    await audit({ vendor: target.vendor, action: 'DOCUMENT_VIEWED', reviewer: req.user._id, provider: req.params.type === 'document' ? target.provider : 'MANUAL', document: req.params.type === 'document' ? target._id : undefined, parkingAuthorization: req.params.type === 'authorization' ? target._id : undefined });
    res.set('Cache-Control', 'no-store, private');
    res.set('Content-Security-Policy', "default-src 'none'; sandbox");
    res.set('X-Content-Type-Options', 'nosniff');
    const extension = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' }[target.safeMetadata?.mimeType] || 'bin';
    res.set('Content-Disposition', `attachment; filename="verification-document.${extension}"`);
    res.type(target.safeMetadata?.mimeType || 'application/octet-stream');
    return res.send(content);
  } catch (error) {
    if (error.code === 'ENOENT') return res.status(404).json({ success: false, message: 'Private document not found' });
    return next(error);
  }
};

module.exports = { listVerificationCases, getVerificationCase, reviewEvidence, readEvidence };
