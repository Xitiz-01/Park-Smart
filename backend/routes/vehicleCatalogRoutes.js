const express = require('express');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const controller = require('../controllers/vehicleCatalogController');

const router = express.Router();
router.use(protect, requirePermission('parking:read'));
router.get('/brands', controller.getBrands);
router.get('/models', controller.getModels);
router.get('/years', controller.getModelYears);
router.get('/details', controller.getModelDetails);

module.exports = router;
