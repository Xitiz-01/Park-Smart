const test = require('node:test');
const assert = require('node:assert/strict');
const { isOpenForWindow, parseWindow } = require('../services/parkingAvailabilityService');
const {
  LocalVehicleCatalogProvider,
  VehicleCatalogService,
} = require('../services/vehicleCatalogService');

const closedWeek = () => Object.fromEntries(
  ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    .map((day) => [day, { open: false, allDay: false, openTime: '06:00', closeTime: '23:00' }])
);

test('operating hours evaluate full reservation windows in Asia/Kolkata', () => {
  const operatingHours = closedWeek();
  operatingHours.monday = { open: true, allDay: false, openTime: '06:00', closeTime: '23:00' };
  const location = { operatingHours };
  assert.equal(isOpenForWindow(location, new Date('2026-09-28T01:00:00Z'), new Date('2026-09-28T17:00:00Z')), true);
  assert.equal(isOpenForWindow(location, new Date('2026-09-28T01:00:00Z'), new Date('2026-09-28T18:00:00Z')), false);
});

test('overnight operating hours cover the next local day without gaps', () => {
  const operatingHours = closedWeek();
  operatingHours.friday = { open: true, allDay: false, openTime: '22:00', closeTime: '02:00' };
  const location = { operatingHours };
  assert.equal(isOpenForWindow(location, new Date('2026-10-02T17:00:00Z'), new Date('2026-10-02T20:00:00Z')), true);
  assert.equal(isOpenForWindow(location, new Date('2026-10-02T20:00:00Z'), new Date('2026-10-02T22:00:00Z')), false);
});

test('time range validation rejects inverted and excessive windows', () => {
  assert.ok(parseWindow('invalid', 'also-invalid').error);
  assert.ok(parseWindow(new Date(Date.now() + 3600000), new Date(Date.now() + 9 * 24 * 3600000)).error);
});

test('vehicle catalog returns normalized brands, models, and electric metadata', async () => {
  const service = new VehicleCatalogService();
  const { brands } = await service.getBrands({ vehicleType: 'suv' });
  assert.ok(brands.includes('Mahindra'));
  const { models } = await service.getModels('Mahindra', { vehicleType: 'suv' });
  assert.ok(models.some((item) => item.model === 'XEV 9e'));
  const details = await service.getModelDetails('mahindra', 'xev 9E');
  assert.equal(details.vehicleType, 'suv');
  assert.deepEqual(details.fuelTypes, ['electric']);
});

test('vehicle catalog caches provider responses', async () => {
  let brandCalls = 0;
  let modelCalls = 0;
  const primaryProvider = {
    name: 'test-primary',
    async getBrands() { brandCalls += 1; return ['Test Brand']; },
    async getModels() {
      modelCalls += 1;
      return [{ model: 'Test Model', vehicleType: 'car', fuelTypes: ['petrol'] }];
    },
  };
  const service = new VehicleCatalogService({ primaryProvider, ttlMs: 60000 });
  assert.deepEqual((await service.getBrands()).brands, ['Test Brand']);
  assert.deepEqual((await service.getBrands()).brands, ['Test Brand']);
  assert.equal((await service.getModels('Test Brand')).models[0].model, 'Test Model');
  assert.equal((await service.getModels('test brand')).models[0].model, 'Test Model');
  assert.equal(brandCalls, 1);
  assert.equal(modelCalls, 1);
});

test('vehicle catalog falls back when a primary provider fails', async () => {
  const primaryProvider = { name: 'offline', async getBrands() { throw new Error('offline'); } };
  const fallbackProvider = new LocalVehicleCatalogProvider([
    { brand: 'Fallback Motors', model: 'Reliable', vehicleType: 'car', fuelTypes: ['petrol'] },
  ]);
  const service = new VehicleCatalogService({ primaryProvider, fallbackProvider });
  const result = await service.getBrands();
  assert.deepEqual(result.brands, ['Fallback Motors']);
  assert.equal(result.source, 'curated-india');
});
