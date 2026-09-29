const { vehicleCatalogService } = require('../services/vehicleCatalogService');

const getBrands = async (req, res) => {
  try {
    const result = await vehicleCatalogService.getMakes();
    res.json({ success: true, makes: result.makes, brands: result.makes });
  } catch {
    res.status(503).json({ success: false, message: 'Vehicle catalog is temporarily unavailable' });
  }
};

const getModels = async (req, res) => {
  try {
    const make = String(req.query.make || req.query.brand || '').trim();
    if (!make) return res.status(400).json({ success: false, message: 'Make is required' });
    const result = await vehicleCatalogService.getModels(make);
    if (!result.models.length) return res.status(404).json({ success: false, message: 'Make was not found in the vehicle catalog' });
    res.json({ success: true, make: result.make, brand: result.make, models: result.models });
  } catch {
    res.status(503).json({ success: false, message: 'Vehicle catalog is temporarily unavailable' });
  }
};

const getModelYears = async (req, res) => {
  try {
    const make = String(req.query.make || req.query.brand || '').trim();
    const model = String(req.query.model || '').trim();
    if (!make || !model) return res.status(400).json({ success: false, message: 'Make and model are required' });
    const result = await vehicleCatalogService.getModelYears(make, model);
    res.json({ success: true, ...result });
  } catch {
    res.status(503).json({ success: false, message: 'Vehicle catalog is temporarily unavailable' });
  }
};

const getModelDetails = async (req, res) => {
  try {
    const make = String(req.query.make || req.query.brand || '').trim();
    const model = String(req.query.model || '').trim();
    const modelYear = req.query.modelYear || req.query.year;
    if (!make || !model) return res.status(400).json({ success: false, message: 'Make and model are required' });
    const details = await vehicleCatalogService.getModelDetails(make, model, modelYear);
    if (!details) return res.status(404).json({ success: false, message: 'Vehicle model was not found in the catalog' });
    const { source, ...vehicle } = details;
    res.json({ success: true, vehicle });
  } catch {
    res.status(503).json({ success: false, message: 'Vehicle catalog is temporarily unavailable' });
  }
};

module.exports = { getBrands, getModels, getModelYears, getModelDetails };
