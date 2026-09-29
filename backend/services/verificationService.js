const VendorVerification = require('../models/VendorVerification');
const VerificationDocument = require('../models/VerificationDocument');
const ParkingAuthorization = require('../models/ParkingAuthorization');
const VerificationAudit = require('../models/VerificationAudit');

const STATUS_PRIORITY = [
  'REJECTED', 'RESUBMISSION_REQUIRED', 'UNDER_REVIEW', 'PENDING', 'VERIFIED', 'NOT_STARTED',
];

const aggregateStatus = (documents) => {
  if (!documents.length) return 'NOT_STARTED';
  const latestByType = new Map();
  documents.forEach((document) => {
    if (!latestByType.has(document.documentType)) latestByType.set(document.documentType, document);
  });
  const current = new Set([...latestByType.values()].map((document) => document.status));
  return STATUS_PRIORITY.find((status) => current.has(status)) || 'NOT_STARTED';
};

const getOrCreateVerification = (vendorId) => VendorVerification.findOneAndUpdate(
  { vendor: vendorId },
  { $setOnInsert: { vendor: vendorId } },
  { upsert: true, new: true, setDefaultsOnInsert: true }
);

const recomputeVerification = async (vendorId, review = {}) => {
  const verification = await getOrCreateVerification(vendorId);
  const documents = await VerificationDocument.find({ vendor: vendorId }).sort({ createdAt: -1 });
  verification.identityStatus = aggregateStatus(documents.filter((document) => document.category === 'IDENTITY'));
  verification.businessStatus = aggregateStatus(documents.filter((document) => document.category === 'BUSINESS'));
  verification.bankStatus = aggregateStatus(documents.filter((document) => document.category === 'BANK'));
  const parts = [verification.identityStatus, verification.businessStatus, verification.bankStatus];
  if (parts.every((status) => status === 'VERIFIED')) verification.overallStatus = 'VERIFIED';
  else if (parts.includes('REJECTED')) verification.overallStatus = 'REJECTED';
  else if (parts.includes('RESUBMISSION_REQUIRED')) verification.overallStatus = 'RESUBMISSION_REQUIRED';
  else if (parts.some((status) => ['UNDER_REVIEW', 'VERIFIED'].includes(status))) verification.overallStatus = 'UNDER_REVIEW';
  else if (parts.includes('PENDING')) verification.overallStatus = 'PENDING';
  else verification.overallStatus = 'NOT_STARTED';
  verification.submittedAt ||= documents[documents.length - 1]?.submittedAt;
  if (review.reviewer) {
    verification.reviewedBy = review.reviewer;
    verification.reviewedAt = new Date();
  }
  verification.provider = documents.at(0)?.provider || verification.provider;
  const activeRejection = documents.find((document) => document.status === 'REJECTED');
  const activeResubmission = documents.find((document) => document.status === 'RESUBMISSION_REQUIRED');
  verification.rejectionReason = review.rejectionReason || activeRejection?.rejectionReason || undefined;
  verification.resubmissionReason = review.resubmissionReason || activeResubmission?.resubmissionReason || undefined;
  if (verification.overallStatus === 'VERIFIED') {
    verification.rejectionReason = undefined;
    verification.resubmissionReason = undefined;
  }
  await verification.save();
  return verification;
};

const audit = (entry) => VerificationAudit.create(entry);

const getVerificationSummary = async (vendorId) => {
  const [verification, documents, authorizations, audits] = await Promise.all([
    getOrCreateVerification(vendorId),
    VerificationDocument.find({ vendor: vendorId }).sort({ createdAt: -1 }),
    ParkingAuthorization.find({ vendor: vendorId }).populate('parkingLocation', 'name status').sort({ createdAt: -1 }),
    VerificationAudit.find({ vendor: vendorId }).populate('reviewer', 'name email').sort({ createdAt: -1 }).limit(100),
  ]);
  return {
    verification: verification.toJSON(),
    documents,
    parkingAuthorizations: authorizations,
    audit: audits,
  };
};

const canPublishLocation = async (vendorId, locationId) => {
  const [verification, authorization] = await Promise.all([
    VendorVerification.findOne({ vendor: vendorId }),
    ParkingAuthorization.findOne({ vendor: vendorId, parkingLocation: locationId, status: 'VERIFIED' }).sort({ createdAt: -1 }),
  ]);
  return {
    allowed: verification?.overallStatus === 'VERIFIED' && Boolean(authorization),
    verificationStatus: verification?.overallStatus || 'NOT_STARTED',
    authorizationStatus: authorization ? 'VERIFIED' : 'NOT_VERIFIED',
  };
};

module.exports = {
  aggregateStatus,
  getOrCreateVerification,
  recomputeVerification,
  getVerificationSummary,
  canPublishLocation,
  audit,
};
