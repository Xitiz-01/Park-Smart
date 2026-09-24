const GeocodingService = require('../services/geocodingService');

const autocompleteAddress = async (req, res, next) => {
  try {
    const query = String(req.query.q || '').trim();
    if (query.length < 3 || query.length > 120) {
      return res.status(400).json({ success: false, message: 'Address query must be between 3 and 120 characters' });
    }
    const suggestions = await GeocodingService.autocomplete(query);
    res.json({ success: true, suggestions });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    next(error);
  }
};

module.exports = { autocompleteAddress };
