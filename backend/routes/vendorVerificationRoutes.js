const express = require('express');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { requireApprovedVendor } = require('../middleware/vendorMiddleware');
const { verificationUpload, validateUploadedDocument } = require('../middleware/verificationUpload');
const { verificationRateLimit } = require('../middleware/verificationRateLimit');
const controller = require('../controllers/vendorVerificationController');
const { validate } = require('../src/platform/http/validate');
const schemas = require('../src/schemas/verification');

const router = express.Router();

router.use(protect, requirePermission('verification:manage-own'), requireApprovedVendor, verificationRateLimit);
router.get('/', controller.getMyVerification);
// Multer parses the form first, so the fields exist when they're validated.
router.post('/documents', verificationUpload, validate({ body: schemas.documentUpload }), validateUploadedDocument, controller.submitManualDocument);
router.post(
  '/parking-authorizations/:locationId',
  verificationUpload,
  validate({ params: schemas.parkingAuthorization, body: schemas.documentUpload }),
  validateUploadedDocument,
  controller.submitParkingAuthorization,
);
router.post('/external/:kind', validate({ params: schemas.externalCheck, body: schemas.externalCheckInput }), controller.verifyWithCashfree);

module.exports = router;
