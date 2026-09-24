const express = require('express');
const {
  registerVendor,
  getMyVendorProfile,
  updateMyVendorProfile,
  getVendorDashboard,
} = require('../controllers/vendorController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { requireApprovedVendor } = require('../middleware/vendorMiddleware');

const router = express.Router();

router.use(protect);
router.post('/register', registerVendor);
router.get('/me', getMyVendorProfile);
router.put('/me', updateMyVendorProfile);
router.get('/dashboard', authorizeRoles('vendor'), requireApprovedVendor, getVendorDashboard);

module.exports = router;
