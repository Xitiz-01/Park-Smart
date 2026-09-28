const express = require('express');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { nearbyParking, getParkingLocation } = require('../controllers/parkingDiscoveryController');

const router = express.Router();
router.use(protect, requirePermission('parking:read'));
router.get('/nearby', nearbyParking);
router.get('/:id', getParkingLocation);

module.exports = router;
