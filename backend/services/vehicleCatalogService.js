const catalog = require('../data/vehicleCatalog');
const {
  ApiNinjasVehicleProvider,
  NhtsaVehicleProvider,
  canonicalMake,
  canonicalModel,
  normalizeKey,
  normalizeYear,
} = require('./vehicleCatalogProviders');

const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const currentYear = () => new Date().getFullYear();
const yearsForEntry = (entry) => {
  if (Array.isArray(entry.modelYears)) return entry.modelYears.map(normalizeYear).filter(Boolean).sort((a, b) => b - a);
  const from = normalizeYear(entry.yearFrom);
  const to = normalizeYear(entry.yearTo) || currentYear();
  if (!from || to < from) return [];
  return Array.from({ length: to - from + 1 }, (_, index) => to - index);
};

class LocalVehicleCatalogProvider {
  constructor(entries = catalog) {
    this.entries = entries.map((entry) => ({
      ...entry,
      make: canonicalMake(entry.make || entry.brand),
      model: canonicalModel(entry.model),
      modelYears: yearsForEntry(entry),
    }));
    this.name = 'curated-india-supplement';
    this.isRemote = false;
  }

  async getMakes() {
    return [...new Set(this.entries.map((entry) => entry.make))].sort((a, b) => a.localeCompare(b));
  }

  async getBrands() { return this.getMakes(); }

  async getModels(make) {
    return this.entries
      .filter((entry) => normalizeKey(entry.make) === normalizeKey(make))
      .map((entry) => ({
        make: entry.make, model: entry.model, vehicleType: entry.vehicleType,
        bodyStyle: entry.bodyStyle || null, fuelTypes: [...(entry.fuelTypes || [])],
        modelYears: [...entry.modelYears], yearFrom: entry.modelYears.at(-1) || null,
        yearTo: entry.modelYears[0] || null,
      }))
      .sort((a, b) => a.model.localeCompare(b.model));
  }

  async getModelYears(make, model) {
    const entry = this.entries.find((item) => normalizeKey(item.make) === normalizeKey(make) && normalizeKey(item.model) === normalizeKey(model));
    return entry ? [...entry.modelYears] : [];
  }

  async getModelDetails(make, model, modelYear) {
    const entry = this.entries.find((item) => normalizeKey(item.make) === normalizeKey(make) && normalizeKey(item.model) === normalizeKey(model));
    if (!entry) return null;
    const selectedYear = normalizeYear(modelYear);
    if (selectedYear && entry.modelYears.length && !entry.modelYears.includes(selectedYear)) return null;
    return {
      make: entry.make, model: entry.model, modelYear: selectedYear,
      vehicleType: entry.vehicleType || null, bodyStyle: entry.bodyStyle || null,
      bodyStyles: entry.bodyStyle ? [entry.bodyStyle] : [],
      fuelTypes: [...(entry.fuelTypes || [])], modelYears: [...entry.modelYears],
    };
  }
}

const mergeModels = (resultSets) => {
  const models = new Map();
  for (const item of resultSets.flat().filter(Boolean)) {
    const make = canonicalMake(item.make || item.brand);
    const model = canonicalModel(item.model);
    if (!make || !model) continue;
    const key = `${normalizeKey(make)}:${normalizeKey(model)}`;
    const existing = models.get(key) || {
      make, brand: make, model, vehicleType: null, bodyStyle: null,
      fuelTypes: [], modelYears: [], yearFrom: null, yearTo: null,
    };
    existing.vehicleType ||= item.vehicleType || null;
    existing.bodyStyle ||= item.bodyStyle || null;
    existing.fuelTypes = [...new Set([...existing.fuelTypes, ...(item.fuelTypes || [])])];
    existing.modelYears = [...new Set([...existing.modelYears, ...(item.modelYears || []).map(normalizeYear).filter(Boolean)])].sort((a, b) => b - a);
    existing.yearFrom = existing.modelYears.at(-1) || item.yearFrom || existing.yearFrom;
    existing.yearTo = existing.modelYears[0] || item.yearTo || existing.yearTo;
    models.set(key, existing);
  }
  return [...models.values()].sort((a, b) => a.model.localeCompare(b.model));
};

const mergeDetails = (details, requestedYear) => {
  const matches = details.filter(Boolean);
  if (!matches.length) return null;
  const first = matches[0];
  const bodyStyles = [...new Set(matches.flatMap((item) => item.bodyStyles || (item.bodyStyle ? [item.bodyStyle] : [])))];
  const fuelTypes = [...new Set(matches.flatMap((item) => item.fuelTypes || []))];
  const modelYears = [...new Set(matches.flatMap((item) => item.modelYears || []).map(normalizeYear).filter(Boolean))].sort((a, b) => b - a);
  const modelYear = normalizeYear(requestedYear);
  return {
    make: canonicalMake(first.make || first.brand),
    brand: canonicalMake(first.make || first.brand),
    model: canonicalModel(first.model),
    modelYear,
    vehicleType: matches.find((item) => item.vehicleType)?.vehicleType || null,
    bodyStyle: matches.find((item) => item.bodyStyle)?.bodyStyle || (bodyStyles.length === 1 ? bodyStyles[0] : null),
    bodyStyles,
    fuelTypes,
    modelYears,
  };
};

class VehicleCatalogService {
  constructor({
    providers,
    primaryProvider = null,
    secondaryProviders = [],
    fallbackProvider = new LocalVehicleCatalogProvider(),
    ttlMs = 6 * 60 * 60 * 1000,
  } = {}) {
    this.providers = providers || [primaryProvider, ...secondaryProviders, fallbackProvider].filter(Boolean);
    this.ttlMs = ttlMs;
    this.cache = new Map();
  }

  async providerResults(method, args) {
    const supported = this.providers.filter((provider) => typeof provider[method] === 'function');
    const outcomes = await Promise.allSettled(supported.map((provider) => provider[method](...args)));
    const values = [];
    let remoteSuccesses = 0;
    let remoteFailures = 0;
    outcomes.forEach((outcome, index) => {
      const provider = supported[index];
      if (outcome.status === 'fulfilled') {
        values.push(outcome.value);
        if (provider.isRemote) remoteSuccesses += 1;
      } else if (provider.isRemote) remoteFailures += 1;
    });
    if (!values.length) throw outcomes.find((item) => item.status === 'rejected')?.reason || new Error('Vehicle catalog is unavailable');
    return {
      values,
      degraded: remoteFailures > 0 && remoteSuccesses === 0 && supported.some((provider) => provider.isRemote),
    };
  }

  async cached(cacheKey, loader) {
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return clone(cached.value);
    try {
      const { value, degraded = false } = await loader();
      if (degraded && cached) return clone(cached.value);
      this.cache.set(cacheKey, { value: clone(value), expiresAt: Date.now() + this.ttlMs });
      return clone(value);
    } catch (error) {
      if (cached) return clone(cached.value);
      throw error;
    }
  }

  async getMakes() {
    return this.cached('makes', async () => {
      const { values, degraded } = await this.providerResults('getMakes', []);
      const makes = [...new Set(values.flat().map(canonicalMake).filter(Boolean))].sort((a, b) => a.localeCompare(b));
      return { value: { makes, brands: makes }, degraded };
    });
  }

  async getBrands() { return this.getMakes(); }

  async getModels(make) {
    const normalizedMake = canonicalMake(make);
    return this.cached(`models:${normalizeKey(normalizedMake)}`, async () => {
      const { values, degraded } = await this.providerResults('getModels', [normalizedMake]);
      return { value: { make: normalizedMake, brand: normalizedMake, models: mergeModels(values) }, degraded };
    });
  }

  async getModelYears(make, model) {
    return this.cached(`years:${normalizeKey(make)}:${normalizeKey(model)}`, async () => {
      const { values, degraded } = await this.providerResults('getModelYears', [make, model]);
      const years = [...new Set(values.flat().map(normalizeYear).filter(Boolean))].sort((a, b) => b - a);
      return { value: { make: canonicalMake(make), brand: canonicalMake(make), model: canonicalModel(model), years }, degraded };
    });
  }

  async getModelDetails(make, model, modelYear) {
    const year = normalizeYear(modelYear);
    return this.cached(`details:${normalizeKey(make)}:${normalizeKey(model)}:${year || ''}`, async () => {
      const { values, degraded } = await this.providerResults('getModelDetails', [make, model, year]);
      return { value: mergeDetails(values, year), degraded };
    });
  }

  clearCache() { this.cache.clear(); }
}

const createDefaultProviders = () => {
  const providers = [];
  if (process.env.NODE_ENV !== 'test') {
    if (process.env.API_NINJAS_API_KEY) providers.push(new ApiNinjasVehicleProvider());
    providers.push(new NhtsaVehicleProvider());
  }
  providers.push(new LocalVehicleCatalogProvider());
  return providers;
};

const vehicleCatalogService = new VehicleCatalogService({ providers: createDefaultProviders() });

module.exports = {
  LocalVehicleCatalogProvider,
  VehicleCatalogService,
  createDefaultProviders,
  mergeDetails,
  mergeModels,
  vehicleCatalogService,
};
