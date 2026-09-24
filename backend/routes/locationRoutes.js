const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { autocompleteAddress } = require('../controllers/locationController');

const router = express.Router();
router.get('/autocomplete', protect, autocompleteAddress);

module.exports = router;
