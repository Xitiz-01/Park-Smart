const { z, objectId, dateTime, text, numeric } = require('./common');

const locationId = z.object({ id: objectId });
const slotId = z.object({ slotId: objectId });
const vendorBookingId = z.object({ bookingId: objectId });

const address = z.looseObject({
  formattedAddress: text(500).optional(),
  line1: text(300).optional(),
  line2: text(300).optional(),
  city: text(120).optional(),
  state: text(120).optional(),
  pincode: text(12).optional(),
});

// Create and update share one shape; validateParkingLocation applies the rules.
const locationInput = z.looseObject({
  name: text(200).optional(),
  description: text(2000).optional(),
  latitude: numeric.optional(),
  longitude: numeric.optional(),
  selectionToken: text(4000).optional(),
  address: address.optional(),
  vehicleTypes: z.array(text(20)).max(10).optional(),
  pricing: z.record(z.string(), numeric).optional(),
  capacity: z.record(z.string(), numeric).optional(),
  amenities: z.array(text(40)).max(20).optional(),
  operatingHours: z.looseObject({}).optional(),
});

const slotInput = z.looseObject({
  slotNumber: z.union([text(20), z.number()]).optional(),
  prefix: text(10).optional(),
  count: numeric.optional(),
  vehicleType: text(20).optional(),
  status: text(30).optional(),
});

const availabilityQuery = z.looseObject({
  startTime: dateTime.optional(),
  endTime: dateTime.optional(),
});

module.exports = { locationId, slotId, vendorBookingId, locationInput, slotInput, availabilityQuery };
