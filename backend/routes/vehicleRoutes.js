const express = require('express');
const router = express.Router();
const { getMyVehicles, addVehicle, updateVehicle, deleteVehicle } = require('../controllers/vehicleController');
const { protect } = require('../middleware/authMiddleware');
const { validate } = require('../src/platform/http/validate');
const { vehicleId, vehicleInput } = require('../src/schemas/vehicles');

router.use(protect);

router.get('/', getMyVehicles);
router.post('/', validate({ body: vehicleInput }), addVehicle);
router.put('/:id', validate({ params: vehicleId, body: vehicleInput }), updateVehicle);
router.delete('/:id', validate({ params: vehicleId }), deleteVehicle);

module.exports = router;
