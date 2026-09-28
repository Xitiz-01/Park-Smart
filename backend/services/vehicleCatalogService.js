const catalog = require('../data/vehicleCatalog');

const normalize = (value) => String(value || '').trim().toLocaleLowerCase('en-IN');
const clone = (value) => JSON.parse(JSON.stringify(value));

class LocalVehicleCatalogProvider {
  constructor(entries = catalog) {
    this.entries = entries;
    this.name = 'curated-india';
  }

  async getBrands({ vehicleType } = {}) {
    const matches = vehicleType ? this.entries.filter((entry) => entry.vehicleType === vehicleType) : this.entries;
    return [...new Set(matches.map((entry) => entry.brand))].sort((a, b) => a.localeCompare(b));
  }

  async getModels(brand, { vehicleType } = {}) {
    return this.entries
      .filter((entry) => normalize(entry.brand) === normalize(brand) && (!vehicleType || entry.vehicleType === vehicleType))
      .map((entry) => ({ model: entry.model, vehicleType: entry.vehicleType, fuelTypes: [...entry.fuelTypes] }))
      .sort((a, b) => a.model.localeCompare(b.model));
  }

  async getModelDetails(brand, model) {
    const entry = this.entries.find((item) => (
      normalize(item.brand) === normalize(brand) && normalize(item.model) === normalize(model)
    ));
    return entry ? clone(entry) : null;
  }
}

class VehicleCatalogService {
  constructor({ primaryProvider = null, fallbackProvider = new LocalVehicleCatalogProvider(), ttlMs = 6 * 60 * 60 * 1000 } = {}) {
    this.primaryProvider = primaryProvider;
    this.fallbackProvider = fallbackProvider;
    this.ttlMs = ttlMs;
    this.cache = new Map();
  }

  async resolve(cacheKey, method, args) {
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return { value: clone(cached.value), source: cached.source };

    let value;
    let source = this.fallbackProvider.name || 'fallback';
    if (this.primaryProvider) {
      try {
        value = await this.primaryProvider[method](...args);
        source = this.primaryProvider.name || 'primary';
      } catch {
        value = undefined;
      }
    }
    if (value === undefined || value === null) {
      value = await this.fallbackProvider[method](...args);
      source = this.fallbackProvider.name || 'fallback';
    }
    this.cache.set(cacheKey, { value: clone(value), source, expiresAt: Date.now() + this.ttlMs });
    return { value: clone(value), source };
  }

  async getBrands(options = {}) {
    const vehicleType = normalize(options.vehicleType) || '';
    const { value, source } = await this.resolve(`brands:${vehicleType}`, 'getBrands', [{ vehicleType: vehicleType || undefined }]);
    return { brands: value, source };
  }

  async getModels(brand, options = {}) {
    const vehicleType = normalize(options.vehicleType) || '';
    const { value, source } = await this.resolve(`models:${normalize(brand)}:${vehicleType}`, 'getModels', [brand, { vehicleType: vehicleType || undefined }]);
    return { brand, models: value, source };
  }

  async getModelDetails(brand, model) {
    const { value, source } = await this.resolve(`details:${normalize(brand)}:${normalize(model)}`, 'getModelDetails', [brand, model]);
    return value ? { ...value, source } : null;
  }

  clearCache() { this.cache.clear(); }
}

const vehicleCatalogService = new VehicleCatalogService();

module.exports = {
  LocalVehicleCatalogProvider,
  VehicleCatalogService,
  vehicleCatalogService,
};
