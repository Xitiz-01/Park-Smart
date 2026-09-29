const express = require('express');
const {
  registerVendor,
  getMyVendorProfile,
  updateMyVendorProfile,
  getVendorDashboard,
} = require('../controllers/vendorController');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { requireApprovedVendor } = require('../middleware/vendorMiddleware');
const parking = require('../controllers/vendorParkingController');

const router = express.Router();

router.use(protect);
router.post('/register', requirePermission('vendor:apply'), registerVendor);
router.get('/me', getMyVendorProfile);
router.put('/me', updateMyVendorProfile);
router.get('/dashboard', requirePermission('parking:create'), requireApprovedVendor, getVendorDashboard);

router.use(requirePermission('parking:create'), requireApprovedVendor);
router.get('/parking-locations', parking.getParkingLocations);
router.post('/parking-locations', parking.createParkingLocation);
router.get('/parking-locations/:id', parking.getParkingLocation);
router.patch('/parking-locations/:id', parking.updateParkingLocation);
router.post('/parking-locations/:id/publish', parking.publishParkingLocation);
router.delete('/parking-locations/:id', parking.deactivateParkingLocation);
router.get('/parking-locations/:id/slots', parking.getLocationSlots);
router.post('/parking-locations/:id/slots', parking.createSlot);
router.post('/parking-locations/:id/slots/bulk', parking.bulkCreateSlots);
router.patch('/slots/:slotId', parking.updateSlot);
router.get('/bookings', parking.getVendorBookings);
router.put('/bookings/:bookingId/checkin', requirePermission('booking:manage-vendor'), parking.checkInVendorBooking);
router.put('/bookings/:bookingId/checkout', requirePermission('booking:manage-vendor'), parking.checkOutVendorBooking);

module.exports = router;
