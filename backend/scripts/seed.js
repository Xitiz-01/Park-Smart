// Seed a LOCAL development database with four accounts and illustrative
// data: an approved vendor with two published locations (one with six EV
// bays) and a draft, a pending vendor applicant, and a customer with a petrol
// and an electric car. Bookings are left to the app, so the reservation
// ledger only ever holds entries the booking code wrote.
//
//   node scripts/seed.js             seed an empty database (fails if users exist)
//   node scripts/seed.js --if-empty  seed only when there are no users (compose runs this)
//   node scripts/seed.js --reset     drop the database first
//
// Accounts are <role>@parksmart.test, created through Better Auth's own
// sign-up so they log in like real users. Their password is SEED_PASSWORD.
// It refuses to run in production or against anything but a local MongoDB.
const mongoose = require('mongoose');
const { getConfig } = require('../src/config/env');
const { logger } = require('../src/platform/logger');

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'mongo']);
const ROLES = ['customer', 'admin', 'vendor', 'applicant'];
const emailFor = (role) => `${role}@parksmart.test`;

// Better Auth is ESM and opens its own MongoDB client; load it once, close it at the end.
let authRuntime;
const betterAuth = () => (authRuntime ??= import('../auth/betterAuth.mjs'));

/** Hosts named in a mongodb:// URI; mongodb+srv:// is never local. */
function mongoHosts(uri) {
  const match = /^mongodb:\/\/(?:[^@/]*@)?([^/?]+)/.exec(uri);
  if (!match) return null;
  return match[1]
    .split(',')
    .map((hostPort) => (hostPort.startsWith('[') ? hostPort.slice(1, hostPort.indexOf(']')) : hostPort.split(':')[0]));
}

function refusal(config) {
  if (config.isProduction) return 'NODE_ENV is production';
  const hosts = mongoHosts(config.mongodbUri);
  if (!hosts || hosts.some((host) => !LOCAL_HOSTS.has(host)))
    return 'MONGODB_URI is not a local MongoDB (localhost or the compose "mongo" service)';
  if (!config.seed.password) return 'SEED_PASSWORD is not set';
  return null;
}

async function createAccounts(password) {
  const { auth, syncAuthIdentityRole } = await betterAuth();
  const User = require('../models/User');
  const accounts = {};
  for (const role of ROLES) {
    const name = `Local ${role[0].toUpperCase()}${role.slice(1)}`;
    await auth.api.signUpEmail({ body: { name, email: emailFor(role), password, phone: '9876543210' } });
    accounts[role] = await User.findOne({ email: emailFor(role) });
  }
  // Applicants stay customers until an admin approves them.
  for (const role of ['admin', 'vendor']) {
    accounts[role].role = role;
    await accounts[role].save();
    await syncAuthIdentityRole(accounts[role].authUserId, role);
  }
  return accounts;
}

async function createDomainData({ admin, vendor, applicant, customer }) {
  const VendorProfile = require('../models/VendorProfile');
  const ParkingLocation = require('../models/ParkingLocation');
  const ParkingSlot = require('../models/ParkingSlot');
  const Vehicle = require('../models/Vehicle');

  const vendorProfile = await VendorProfile.create({
    userId: vendor._id,
    businessName: 'Local Parking Co',
    businessType: 'Parking operator',
    phone: '9876543210',
    address: 'FC Road',
    city: 'Pune',
    state: 'Maharashtra',
    pincode: '411004',
    businessAddress: {
      formattedAddress: 'FC Road, Shivajinagar, Pune, Maharashtra 411004, India',
      addressLine1: 'FC Road',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411004',
      country: 'India',
      verified: true,
    },
    businessLocation: { type: 'Point', coordinates: [73.841, 18.5236] },
    verificationStatus: 'approved',
    vendorStatus: 'active',
    approvedBy: admin._id,
  });
  await VendorProfile.create({
    userId: applicant._id,
    businessName: 'Pending Applicant Garage',
    businessType: 'Garage',
    phone: '9876543212',
    address: 'JM Road',
    city: 'Pune',
    state: 'Maharashtra',
    pincode: '411005',
    verificationStatus: 'pending',
    vendorStatus: 'pending',
  });

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const operatingHours = Object.fromEntries(
    days.map((day) => [day, { open: true, allDay: true, openTime: '00:00', closeTime: '23:59' }]),
  );
  const address = (line) => ({
    formattedAddress: `${line}, Pune, Maharashtra 411004, India`,
    addressLine1: line,
    city: 'Pune',
    district: 'Pune',
    state: 'Maharashtra',
    pincode: '411004',
    country: 'India',
    provider: 'seed',
    providerPlaceId: `seed:${line}`,
    verified: true,
  });
  const now = new Date();
  const [evLocation] = await ParkingLocation.create([
    {
      vendorId: vendorProfile._id,
      name: 'FC Road Multilevel',
      description: 'Local seed location',
      address: address('FC Road'),
      location: { type: 'Point', coordinates: [73.841, 18.5236] },
      vehicleTypes: ['car', 'motorcycle', 'ev'],
      evSupported: true,
      evDetails: { slotCount: 6, chargerType: 'CCS2' },
      operatingHours,
      amenities: ['covered', 'cctv', 'ev_charging'],
      pricing: { car: 60, motorcycle: 20, ev: 90 },
      capacity: { car: 40, motorcycle: 30 },
      status: 'active',
      publishedAt: now,
    },
    {
      vendorId: vendorProfile._id,
      name: 'Deccan Surface Lot',
      description: 'Local seed location',
      address: address('Deccan Gymkhana'),
      location: { type: 'Point', coordinates: [73.84, 18.516] },
      vehicleTypes: ['car', 'motorcycle'],
      evSupported: false,
      operatingHours,
      amenities: ['cctv'],
      pricing: { car: 40, motorcycle: 15 },
      capacity: { car: 20, motorcycle: 10 },
      status: 'active',
      publishedAt: now,
    },
    {
      vendorId: vendorProfile._id,
      name: 'Kothrud Draft Site',
      description: 'Local seed location',
      address: address('Kothrud'),
      location: { type: 'Point', coordinates: [73.8077, 18.5074] },
      vehicleTypes: ['car'],
      operatingHours,
      pricing: { car: 30 },
      capacity: { car: 12 },
      status: 'draft',
    },
  ]);

  // Six EV bays; EV04 in maintenance so boards show more than one state.
  await ParkingSlot.create(
    ['available', 'available', 'available', 'maintenance', 'available', 'available'].map((status, index) => ({
      slotNumber: `EV0${index + 1}`,
      parkingLocation: evLocation._id,
      vehicleType: 'ev',
      type: 'ev',
      evCompatible: true,
      chargerType: index < 2 ? 'DC fast' : 'AC',
      connectorType: 'CCS2',
      chargerPowerKw: index < 2 ? 60 : 22,
      status,
      pricePerHour: 90,
      features: { hasCCTV: true, hasCover: true, hasEVCharger: true },
      location: { lat: 18.5236, lng: 73.841, label: 'FC Road' },
    })),
  );

  await Vehicle.create([
    {
      user: customer._id,
      licensePlate: 'MH12AB1234',
      vehicleType: 'car',
      fuelType: 'petrol',
      make: 'Maruti Suzuki',
      brand: 'Maruti Suzuki',
      model: 'Swift',
      modelYear: 2022,
      bodyStyle: 'hatchback',
      color: 'White',
      isDefault: true,
    },
    {
      user: customer._id,
      licensePlate: 'MH14EV5678',
      vehicleType: 'car',
      fuelType: 'electric',
      make: 'Tata Motors',
      brand: 'Tata Motors',
      model: 'Nexon EV',
      modelYear: 2024,
      bodyStyle: 'suv',
      color: 'Blue',
      isDefault: false,
    },
  ]);
}

async function seed(argv = process.argv.slice(2)) {
  const config = getConfig();
  const reason = refusal(config);
  if (reason) throw new Error(`refusing to seed: ${reason}`);

  await mongoose.connect(config.mongodbUri, { serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection.db;
  if (argv.includes('--reset')) {
    await db.dropDatabase();
    logger.info({ database: db.databaseName }, 'seed: dropped the database');
  }
  const users = await db.collection('users').countDocuments();
  if (users > 0) {
    if (argv.includes('--if-empty')) {
      logger.info({ users }, 'seed: database already has users, nothing to do');
      return;
    }
    throw new Error('refusing to seed: the database already has users (use --reset to start over)');
  }

  // Dropping the database also drops the indexes the running API built at
  // startup, and it won't build them again; without the 2dsphere index,
  // nearby search fails. Build them before inserting anything.
  await mongoose.connection.syncIndexes();
  const accounts = await createAccounts(config.seed.password);
  await createDomainData(accounts);
  logger.info(
    { accounts: ROLES.map(emailFor), locations: 3, evBays: 6, vehicles: 2 },
    'seed: done; sign in with SEED_PASSWORD',
  );
}

/** Close Mongoose and Better Auth's client. */
const closeConnections = () =>
  Promise.allSettled([mongoose.disconnect(), authRuntime?.then((runtime) => runtime.close())]);

if (require.main === module) {
  seed()
    .then(
      () => 0,
      (error) => {
        logger.error({ err: error }, 'seed failed');
        return 1;
      },
    )
    .then(async (code) => {
      await closeConnections();
      process.exit(code);
    });
}

module.exports = { seed, mongoHosts, refusal, closeConnections };
