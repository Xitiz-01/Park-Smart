const express = require('express');
const router = express.Router();
const { createBooking, getMyBookings, getBookingById, cancelBooking, checkIn, checkOut, getAllBookings } = require('../controllers/bookingController');
const { protect, adminOnly, requirePermission } = require('../middleware/authMiddleware');
const { validate } = require('../src/platform/http/validate');
const schemas = require('../src/schemas/bookings');

const byId = validate({ params: schemas.bookingId });

router.post('/', protect, requirePermission('booking:create'), validate({ body: schemas.createBooking }), createBooking);
router.get('/my', protect, getMyBookings);
router.get('/', protect, adminOnly, validate({ query: schemas.listBookings }), getAllBookings);
router.get('/:id', protect, byId, getBookingById);
router.put('/:id/cancel', protect, byId, cancelBooking);
router.put('/:id/checkin', protect, adminOnly, byId, checkIn);
router.put('/:id/checkout', protect, adminOnly, byId, checkOut);

module.exports = router;
