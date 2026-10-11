// ParkSmart redesign fixtures: domain data for the disposable local database.
// Run only via `fixtures.py seed`, which creates the four accounts through the real
// sign-up API first and passes the expected database and data directory in env vars.
// All data is illustrative.

/* global db, print, process, quit */

// Guard: refuse anything that is not our own loopback-only mongod and fixture DB.
const expectedDb = process.env.PARKSMART_FIXTURE_DB || '';
const expectedDbPath = process.env.PARKSMART_FIXTURE_DBPATH || '';
const opts = db.serverCmdLineOpts().parsed;
const bindIps = String(opts.net?.bindIp || '').split(',').map((ip) => ip.trim());
const problems = [];
if (!expectedDb.startsWith('parksmart-fixtures')) problems.push(`unexpected fixture DB name "${expectedDb}"`);
if (db.getName() !== expectedDb) problems.push(`connected to "${db.getName()}", expected "${expectedDb}"`);
if (!expectedDbPath || opts.storage?.dbPath !== expectedDbPath) problems.push(`mongod dbPath "${opts.storage?.dbPath}" is not the fixture data dir`);
if (!bindIps.length || bindIps.some((ip) => !['127.0.0.1', 'localhost', '::1'].includes(ip))) problems.push(`mongod bindIp "${opts.net?.bindIp}" is not loopback-only`);
if (problems.length) {
  print(`REFUSING TO SEED: ${problems.join('; ')}`);
  quit(2);
}

const now = new Date();
const user = (email) => {
  const found = db.users.findOne({ email });
  if (!found) { print(`REFUSING TO SEED: ${email} was not created by the sign-up step`); quit(3); }
  return found;
};
const admin = user('fixture-admin@parksmart.test');
const vendor = user('fixture-vendor@parksmart.test');
const applicant = user('fixture-applicant@parksmart.test');
const customer = user('fixture-customer@parksmart.test');

db.users.updateOne({ _id: admin._id }, { $set: { role: 'admin' } });
db.users.updateOne({ _id: vendor._id }, { $set: { role: 'vendor' } });

const vendorProfileId = db.vendorprofiles.insertOne({
  userId: vendor._id, businessName: 'Fixture Parking Co', businessType: 'Parking operator', phone: '9876543210',
  address: 'FC Road', city: 'Pune', state: 'Maharashtra', pincode: '411004',
  businessAddress: {
    formattedAddress: 'FC Road, Shivajinagar, Pune, Maharashtra 411004, India', addressLine1: 'FC Road',
    city: 'Pune', state: 'Maharashtra', pincode: '411004', country: 'India', verified: true,
  },
  businessLocation: { type: 'Point', coordinates: [73.8410, 18.5236] },
  verificationStatus: 'approved', vendorStatus: 'active', approvedBy: admin._id, createdAt: now, updatedAt: now,
}).insertedId;

// Pending applicant, so Admin → Vendor Management and /vendor/status have data.
db.vendorprofiles.insertOne({
  userId: applicant._id, businessName: 'Pending Applicant Garage', businessType: 'Garage', phone: '9876543212',
  address: 'JM Road', city: 'Pune', state: 'Maharashtra', pincode: '411005',
  verificationStatus: 'pending', vendorStatus: 'pending', createdAt: now, updatedAt: now,
});

const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const allDay = Object.fromEntries(days.map((day) => [day, { open: true, allDay: true, openTime: '00:00', closeTime: '23:59' }]));
const address = (line) => ({
  formattedAddress: `${line}, Pune, Maharashtra 411004, India`, addressLine1: line, city: 'Pune', district: 'Pune',
  state: 'Maharashtra', pincode: '411004', country: 'India', provider: 'fixture', providerPlaceId: `fixture:${line}`, verified: true,
});

const evLocationId = db.parkinglocations.insertOne({
  vendorId: vendorProfileId, name: 'FC Road Multilevel', description: 'Illustrative fixture location',
  address: address('FC Road'), location: { type: 'Point', coordinates: [73.8410, 18.5236] },
  vehicleTypes: ['car', 'motorcycle', 'ev'], evSupported: true, evDetails: { slotCount: 6, chargerType: 'CCS2' },
  operatingHours: allDay, amenities: ['covered', 'cctv', 'ev_charging'],
  pricing: { car: 60, motorcycle: 20, ev: 90 }, capacity: { car: 40, motorcycle: 30 },
  status: 'active', publishedAt: now, createdAt: now, updatedAt: now,
}).insertedId;

const regularLocationId = db.parkinglocations.insertOne({
  vendorId: vendorProfileId, name: 'Deccan Surface Lot', description: 'Illustrative fixture location',
  address: address('Deccan Gymkhana'), location: { type: 'Point', coordinates: [73.8400, 18.5160] },
  vehicleTypes: ['car', 'motorcycle'], evSupported: false, operatingHours: allDay, amenities: ['cctv'],
  pricing: { car: 40, motorcycle: 15 }, capacity: { car: 20, motorcycle: 10 },
  status: 'active', publishedAt: now, createdAt: now, updatedAt: now,
}).insertedId;

const draftLocationId = db.parkinglocations.insertOne({
  vendorId: vendorProfileId, name: 'Kothrud Draft Site', description: 'Illustrative fixture location',
  address: address('Kothrud'), location: { type: 'Point', coordinates: [73.8077, 18.5074] },
  vehicleTypes: ['car'], operatingHours: allDay, pricing: { car: 30 }, capacity: { car: 12 },
  status: 'draft', createdAt: now, updatedAt: now,
}).insertedId;

// Six EV bays; EV04 in maintenance so every board shows more than one state.
['available', 'available', 'available', 'maintenance', 'available', 'available'].forEach((status, index) => {
  db.parkingslots.insertOne({
    slotNumber: `EV0${index + 1}`, parkingLocation: evLocationId, vehicleType: 'ev', type: 'ev', evCompatible: true,
    chargerType: index < 2 ? 'DC fast' : 'AC', connectorType: 'CCS2', chargerPowerKw: index < 2 ? 60 : 22,
    status, pricePerHour: 90, features: { hasCCTV: true, hasCover: true, hasEVCharger: true },
    location: { lat: 18.5236, lng: 73.8410, label: 'FC Road' }, createdAt: now, updatedAt: now,
  });
});

const vehicles = db.vehicles.insertMany([
  {
    user: customer._id, licensePlate: 'MH12AB1234', vehicleType: 'car', fuelType: 'petrol', make: 'Maruti Suzuki', brand: 'Maruti Suzuki',
    model: 'Swift', modelYear: 2022, bodyStyle: 'hatchback', color: 'White', isDefault: true, createdAt: now, updatedAt: now,
  },
  {
    user: customer._id, licensePlate: 'MH14EV5678', vehicleType: 'car', fuelType: 'electric', make: 'Tata Motors', brand: 'Tata Motors',
    model: 'Nexon EV', modelYear: 2024, bodyStyle: 'suv', color: 'Blue', isDefault: false, createdAt: now, updatedAt: now,
  },
]).insertedIds;

// Last line is machine-read by fixtures.py.
print(JSON.stringify({
  evLocationId: String(evLocationId), regularLocationId: String(regularLocationId), draftLocationId: String(draftLocationId),
  petrolVehicleId: String(vehicles[0]), evVehicleId: String(vehicles[1]),
}));
