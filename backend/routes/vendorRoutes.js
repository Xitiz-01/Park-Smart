const express = require('express');
const {
  registerVendor,
  getMyVendorProfile,
  updateMyVendorProfile,
  getVendorDashboard,
} = require('../controllers/vendorController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { requireApprovedVendor } = require('../middleware/vendorMiddleware');
const parking = require('../controllers/vendorParkingController');

const router = express.Router();

router.use(protect);
router.post('/register', registerVendor);
router.get('/me', getMyVendorProfile);
router.put('/me', updateMyVendorProfile);
router.get('/dashboard', authorizeRoles('vendor'), requireApprovedVendor, getVendorDashboard);

router.use(authorizeRoles('vendor'), requireApprovedVendor);
router.get('/parking-locations', parking.getParkingLocations);
router.post('/parking-locations', parking.createParkingLocation);
router.get('/parking-locations/:id', parking.getParkingLocation);
router.patch('/parking-locations/:id', parking.updateParkingLocation);
router.delete('/parking-locations/:id', parking.deactivateParkingLocation);
router.get('/parking-locations/:id/slots', parking.getLocationSlots);
router.post('/parking-locations/:id/slots', parking.createSlot);
router.post('/parking-locations/:id/slots/bulk', parking.bulkCreateSlots);
router.patch('/slots/:slotId', parking.updateSlot);
router.get('/bookings', parking.getVendorBookings);

module.exports = router;
