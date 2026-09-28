const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
  token: { type: String, required: true },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const reservationLedgerSchema = new mongoose.Schema({
  resourceKey: { type: String, required: true, unique: true },
  resourceType: { type: String, enum: ['regular', 'ev'], required: true },
  parkingLocation: { type: mongoose.Schema.Types.ObjectId, ref: 'ParkingLocation', required: true, index: true },
  vehicleType: { type: String, enum: ['car', 'bike', 'motorcycle', 'suv', 'ev'], required: true },
  slot: { type: mongoose.Schema.Types.ObjectId, ref: 'ParkingSlot', default: null, index: true },
  reservations: { type: [reservationSchema], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('ReservationLedger', reservationLedgerSchema);
