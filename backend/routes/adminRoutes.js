const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getAllUsers,
  toggleUserStatus,
  getVendors,
  getVendorById,
  approveVendor,
  rejectVendor,
  suspendVendor,
} = require('../controllers/adminController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.use(protect, adminOnly);

router.get('/dashboard', getDashboardStats);
router.get('/users', getAllUsers);
router.put('/users/:id/toggle', toggleUserStatus);
router.get('/vendors', getVendors);
router.get('/vendors/:id', getVendorById);
router.patch('/vendors/:id/approve', approveVendor);
router.patch('/vendors/:id/reject', rejectVendor);
router.patch('/vendors/:id/suspend', suspendVendor);

module.exports = router;
