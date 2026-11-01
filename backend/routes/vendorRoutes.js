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
const { validate } = require('../src/platform/http/validate');
const schemas = require('../src/schemas/parkingLocations');

const router = express.Router();

router.use(protect);
router.post('/register', requirePermission('vendor:apply'), registerVendor);
router.get('/me', getMyVendorProfile);
router.put('/me', updateMyVendorProfile);
router.get('/dashboard', requirePermission('parking:create'), requireApprovedVendor, getVendorDashboard);

router.use(requirePermission('parking:create'), requireApprovedVendor);
const location = validate({ params: schemas.locationId });
const booking = validate({ params: schemas.vendorBookingId });

router.get('/parking-locations', parking.getParkingLocations);
router.post('/parking-locations', validate({ body: schemas.locationInput }), parking.createParkingLocation);
router.get('/parking-locations/:id', location, parking.getParkingLocation);
router.patch('/parking-locations/:id', validate({ params: schemas.locationId, body: schemas.locationInput }), parking.updateParkingLocation);
router.post('/parking-locations/:id/publish', location, parking.publishParkingLocation);
router.delete('/parking-locations/:id', location, parking.deactivateParkingLocation);
router.get('/parking-locations/:id/slots', validate({ params: schemas.locationId, query: schemas.availabilityQuery }), parking.getLocationSlots);
router.post('/parking-locations/:id/slots', validate({ params: schemas.locationId, body: schemas.slotInput }), parking.createSlot);
router.post('/parking-locations/:id/slots/bulk', validate({ params: schemas.locationId, body: schemas.slotInput }), parking.bulkCreateSlots);
router.patch('/slots/:slotId', validate({ params: schemas.slotId, body: schemas.slotInput }), parking.updateSlot);
router.get('/bookings', parking.getVendorBookings);
router.put('/bookings/:bookingId/checkin', requirePermission('booking:manage-vendor'), booking, parking.checkInVendorBooking);
router.put('/bookings/:bookingId/checkout', requirePermission('booking:manage-vendor'), booking, parking.checkOutVendorBooking);

module.exports = router;
