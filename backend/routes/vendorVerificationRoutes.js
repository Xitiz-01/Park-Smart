const express = require('express');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { requireApprovedVendor } = require('../middleware/vendorMiddleware');
const { verificationUpload, validateUploadedDocument } = require('../middleware/verificationUpload');
const { verificationRateLimit } = require('../middleware/verificationRateLimit');
const controller = require('../controllers/vendorVerificationController');

const router = express.Router();

router.get('/digilocker/callback', controller.handleDigiLockerCallback);
router.use(protect, requirePermission('verification:manage-own'), requireApprovedVendor, verificationRateLimit);
router.get('/', controller.getMyVerification);
router.post('/documents', verificationUpload, validateUploadedDocument, controller.submitManualDocument);
router.post('/parking-authorizations/:locationId', verificationUpload, validateUploadedDocument, controller.submitParkingAuthorization);
router.post('/digilocker/start', controller.startDigiLocker);
router.post('/external/:kind', controller.verifyWithCashfree);

module.exports = router;
