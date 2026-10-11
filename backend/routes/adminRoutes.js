const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getAllUsers,
  toggleUserStatus,
  setUserAdminRole,
  getVendors,
  getVendorById,
  approveVendor,
  rejectVendor,
  suspendVendor,
} = require('../controllers/adminController');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const verification = require('../controllers/adminVerificationController');

router.use(protect);

router.get('/dashboard', requirePermission('booking:read-all'), getDashboardStats);
router.get('/users', requirePermission('user:list'), getAllUsers);
router.put('/users/:id/toggle', requirePermission('user:set-status'), toggleUserStatus);
router.patch('/users/:id/role', requirePermission('user:set-admin-role'), setUserAdminRole);
router.get('/vendors', requirePermission('vendor:approve'), getVendors);
router.get('/vendors/:id', requirePermission('vendor:approve'), getVendorById);
router.patch('/vendors/:id/approve', requirePermission('vendor:approve'), approveVendor);
router.patch('/vendors/:id/reject', requirePermission('vendor:approve'), rejectVendor);
router.patch('/vendors/:id/suspend', requirePermission('vendor:approve'), suspendVendor);
router.get('/vendor-verifications', requirePermission('verification:review'), verification.listVerificationCases);
router.get('/vendor-verifications/:vendorId', requirePermission('verification:review'), verification.getVerificationCase);
router.patch('/vendor-verifications/:type/:id/:action', requirePermission('verification:review'), verification.reviewEvidence);
router.get('/vendor-verifications/:type/:id/content', requirePermission('verification:review'), verification.readEvidence);

module.exports = router;
