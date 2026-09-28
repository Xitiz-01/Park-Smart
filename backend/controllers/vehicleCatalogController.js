const { VEHICLE_TYPES } = require('../utils/vehicleClassification');
const { vehicleCatalogService } = require('../services/vehicleCatalogService');

const vehicleTypeOption = (query) => {
  const vehicleType = String(query.vehicleType || '').trim().toLowerCase();
  if (vehicleType && !VEHICLE_TYPES.includes(vehicleType)) return { error: 'Invalid vehicle type' };
  return { vehicleType: vehicleType || undefined };
};

const getBrands = async (req, res) => {
  try {
    const options = vehicleTypeOption(req.query);
    if (options.error) return res.status(400).json({ success: false, message: options.error });
    const result = await vehicleCatalogService.getBrands(options);
    res.json({ success: true, brands: result.brands });
  } catch {
    res.status(503).json({ success: false, message: 'Vehicle catalog is temporarily unavailable' });
  }
};

const getModels = async (req, res) => {
  try {
    const brand = String(req.query.brand || '').trim();
    if (!brand) return res.status(400).json({ success: false, message: 'Brand is required' });
    const options = vehicleTypeOption(req.query);
    if (options.error) return res.status(400).json({ success: false, message: options.error });
    const result = await vehicleCatalogService.getModels(brand, options);
    if (!result.models.length) return res.status(404).json({ success: false, message: 'Brand was not found in the vehicle catalog' });
    res.json({ success: true, brand, models: result.models });
  } catch {
    res.status(503).json({ success: false, message: 'Vehicle catalog is temporarily unavailable' });
  }
};

const getModelDetails = async (req, res) => {
  try {
    const brand = String(req.query.brand || '').trim();
    const model = String(req.query.model || '').trim();
    if (!brand || !model) return res.status(400).json({ success: false, message: 'Brand and model are required' });
    const details = await vehicleCatalogService.getModelDetails(brand, model);
    if (!details) return res.status(404).json({ success: false, message: 'Vehicle model was not found in the catalog' });
    const { source, ...vehicle } = details;
    res.json({ success: true, vehicle });
  } catch {
    res.status(503).json({ success: false, message: 'Vehicle catalog is temporarily unavailable' });
  }
};

module.exports = { getBrands, getModels, getModelDetails };
