const { z, objectId, text } = require('./common');

const vehicleId = z.object({ id: objectId });

// Values such as "Electric" or "EV" are normalised by the controller, so
// enums are checked there, not here.
const vehicleInput = z.looseObject({
  licensePlate: text(32).optional(),
  vehicleType: text(32).optional(),
  fuelType: text(32).nullish(),
  make: text(80).optional(),
  brand: text(80).optional(),
  model: text(80).optional(),
  modelYear: z.union([z.number().int(), text(8)]).nullish(),
  bodyStyle: text(32).nullish(),
  color: text(40).optional(),
  isDefault: z.boolean().optional(),
});

module.exports = { vehicleId, vehicleInput };
