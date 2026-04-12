const express = require('express');
const router = express.Router();
const {
  getAllSlots,
  getNearbySlots,
  getExternalNearbyParking,
  getSlotById,
  createSlot,
  updateSlot,
  deleteSlot,
  seedSlots,
} = require('../controllers/slotController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.get('/', protect, getAllSlots);
router.get('/nearby', protect, getNearbySlots);
router.get('/external-nearby', protect, getExternalNearbyParking);
router.get('/:id', protect, getSlotById);
router.post('/seed', protect, adminOnly, seedSlots);
router.post('/', protect, adminOnly, createSlot);
router.put('/:id', protect, adminOnly, updateSlot);
router.delete('/:id', protect, adminOnly, deleteSlot);

module.exports = router;
