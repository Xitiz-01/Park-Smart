const test = require('node:test');
const assert = require('node:assert/strict');
const { isOpenForWindow, parseWindow, regularCapacityFor } = require('../services/parkingAvailabilityService');
const { LocalVehicleCatalogProvider, VehicleCatalogService } = require('../services/vehicleCatalogService');
const { ApiNinjasVehicleProvider, NhtsaVehicleProvider, VehicleProviderError } = require('../services/vehicleCatalogProviders');

const closedWeek = () => Object.fromEntries(
  ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    .map((day) => [day, { open: false, allDay: false, openTime: '06:00', closeTime: '23:00' }])
);
const response = (payload, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => payload });

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

test('canonical parking capacity combines legacy SUV and bike buckets', () => {
  const location = { capacity: { car: 4, suv: 2, motorcycle: 3, bike: 1 } };
  assert.equal(regularCapacityFor(location, 'car'), 6);
  assert.equal(regularCapacityFor(location, 'motorcycle'), 4);
});

test('local supplement returns canonical types, body style, years, and EV metadata', async () => {
  const service = new VehicleCatalogService();
  const { makes } = await service.getMakes();
  assert.ok(makes.includes('Mahindra'));
  const { models } = await service.getModels('Mahindra');
  assert.ok(models.some((item) => item.model === 'XEV 9e'));
  const details = await service.getModelDetails('mahindra', 'xev 9E', 2026);
  assert.equal(details.vehicleType, 'car');
  assert.equal(details.bodyStyle, 'suv');
  assert.deepEqual(details.fuelTypes, ['electric']);
  assert.ok(details.modelYears.includes(2026));
  assert.ok((await service.getModelYears('Honda', 'City')).years.includes(2008), 'historical Honda City years remain selectable');
  assert.ok((await service.getModelYears('Maruti Suzuki', 'Swift')).years.includes(2015), 'historical Swift years remain selectable');
  assert.ok((await service.getModelYears('Hyundai', 'Creta')).years.includes(2020), 'historical Creta years remain selectable');
  assert.ok((await service.getModelYears('Mahindra', 'XUV700')).years.includes(2024), 'recent XUV700 years remain selectable');
});

test('API Ninjas adapter normalizes a large make list and sends its key only from the backend', async () => {
  const makes = Array.from({ length: 75 }, (_, index) => ({ value: `MAKE ${index}` }));
  let request;
  const provider = new ApiNinjasVehicleProvider({
    apiKey: 'server-secret',
    fetchImpl: async (url, options) => { request = { url, options }; return response({ make: makes }); },
  });
  const result = await provider.getMakes();
  assert.equal(result.length, 75);
  assert.equal(request.options.headers['X-Api-Key'], 'server-secret');
  assert.match(request.url, /carfacets/);
});

test('API Ninjas adapter exposes models, years, body styles, and fuels without fabricating fields', async () => {
  const provider = new ApiNinjasVehicleProvider({
    apiKey: 'key',
    fetchImpl: async (url) => {
      if (url.includes('facets=model')) return response({ model: [{ value: 'XEV 9e' }] });
      if (url.includes('facets=year')) return response({ year: [{ value: 2026 }, { value: 2025 }] });
      return response({ body: [{ value: 'SUV' }], fuel: [{ value: 'Electric' }], year: [{ value: 2026 }] });
    },
  });
  assert.equal((await provider.getModels('Mahindra'))[0].model, 'XEV 9e');
  assert.deepEqual(await provider.getModelYears('Mahindra', 'XEV 9e'), [2026, 2025]);
  assert.deepEqual(await provider.getModelDetails('Mahindra', 'XEV 9e', 2026), {
    make: 'Mahindra', model: 'XEV 9e', modelYear: 2026, vehicleType: 'car',
    bodyStyle: 'suv', bodyStyles: ['suv'], fuelTypes: ['electric'], modelYears: [2026],
  });
});

test('provider failures distinguish timeout, auth, rate-limit, and malformed responses', async (t) => {
  const abortError = Object.assign(new Error('aborted'), { name: 'AbortError' });
  await t.test('timeout', async () => {
    const provider = new ApiNinjasVehicleProvider({ apiKey: 'key', fetchImpl: async () => { throw abortError; } });
    await assert.rejects(provider.getMakes(), (error) => error instanceof VehicleProviderError && error.code === 'timeout');
  });
  for (const [status, code] of [[401, 'invalid_key'], [403, 'forbidden'], [429, 'rate_limited']]) {
    await t.test(String(status), async () => {
      const provider = new ApiNinjasVehicleProvider({ apiKey: 'key', fetchImpl: async () => response({}, status) });
      await assert.rejects(provider.getMakes(), (error) => error.code === code && error.status === status);
    });
  }
  await t.test('malformed facets', async () => {
    const provider = new ApiNinjasVehicleProvider({ apiKey: 'key', fetchImpl: async () => response({}) });
    await assert.rejects(provider.getMakes(), (error) => error.code === 'malformed_response');
  });
});

test('NHTSA adapter keeps ambiguous manufacturer metadata unset', async () => {
  const provider = new NhtsaVehicleProvider({ fetchImpl: async (url) => {
    if (url.includes('GetModelsForMake')) return response({ Results: [{ Make_Name: 'Honda', Model_Name: 'City' }] });
    return response({ Results: [{ VehicleTypeName: 'Passenger Car' }, { VehicleTypeName: 'Motorcycle' }] });
  } });
  const details = await provider.getModelDetails('Honda', 'City');
  assert.equal(details.vehicleType, null);
  assert.equal(details.bodyStyle, null);
  assert.deepEqual(details.fuelTypes, []);
  assert.deepEqual(details.bodyStyles, []);
});

test('vehicle catalog caches make, model, year, and detail responses', async () => {
  const calls = { makes: 0, models: 0, years: 0, details: 0 };
  const provider = {
    name: 'test', isRemote: true,
    async getMakes() { calls.makes += 1; return ['Test Motors']; },
    async getModels() { calls.models += 1; return [{ make: 'Test Motors', model: 'One' }]; },
    async getModelYears() { calls.years += 1; return [2026]; },
    async getModelDetails() { calls.details += 1; return { make: 'Test Motors', model: 'One', modelYears: [2026], bodyStyles: [], fuelTypes: [] }; },
  };
  const service = new VehicleCatalogService({ providers: [provider], ttlMs: 60000 });
  await service.getMakes(); await service.getMakes();
  await service.getModels('Test Motors'); await service.getModels('test motors');
  await service.getModelYears('Test Motors', 'One'); await service.getModelYears('test motors', 'one');
  await service.getModelDetails('Test Motors', 'One', 2026); await service.getModelDetails('test motors', 'one', 2026);
  assert.deepEqual(calls, { makes: 1, models: 1, years: 1, details: 1 });
});

test('vehicle catalog falls back locally and serves stale cache when all remotes degrade', async () => {
  let offline = false;
  const remote = { name: 'remote', isRemote: true, async getMakes() { if (offline) throw new Error('offline'); return ['Online Motors']; } };
  const fallback = new LocalVehicleCatalogProvider([{ make: 'Fallback Motors', model: 'Reliable', vehicleType: 'car', fuelTypes: ['petrol'], yearFrom: 2020 }]);
  const service = new VehicleCatalogService({ providers: [remote, fallback], ttlMs: 1 });
  const fresh = await service.getMakes();
  assert.deepEqual(fresh.makes, ['Fallback Motors', 'Online Motors']);
  offline = true;
  service.cache.get('makes').expiresAt = 0;
  const stale = await service.getMakes();
  assert.deepEqual(stale.makes, fresh.makes);
});
