const DEFAULT_TIMEOUT_MS = 4500;

const normalizeKey = (value) => String(value || '')
  .normalize('NFKD')
  .replace(/[^a-zA-Z0-9]+/g, '')
  .toLowerCase();

const MAKE_NAMES = new Map([
  ['bmw', 'BMW'], ['byd', 'BYD'], ['gmc', 'GMC'], ['mg', 'MG'], ['mini', 'MINI'],
  ['mercedesbenz', 'Mercedes-Benz'], ['rollsroyce', 'Rolls-Royce'], ['landrover', 'Land Rover'],
  ['alfaromeo', 'Alfa Romeo'], ['astonmartin', 'Aston Martin'], ['marutisuzuki', 'Maruti Suzuki'],
  ['tatamotors', 'Tata Motors'], ['tata', 'Tata Motors'],
]);

const canonicalMake = (value) => {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  if (!text) return '';
  const known = MAKE_NAMES.get(normalizeKey(text));
  if (known) return known;
  if (text === text.toUpperCase()) {
    return text.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (letter) => letter.toUpperCase());
  }
  return text;
};

const canonicalModel = (value) => String(value || '').trim().replace(/\s+/g, ' ');

const BODY_STYLE_MAP = new Map([
  ['hatchback', 'hatchback'], ['sedan', 'sedan'], ['saloon', 'sedan'],
  ['suv', 'suv'], ['sportutilityvehicle', 'suv'], ['sportutilityvehiclesuv', 'suv'],
  ['crossover', 'crossover'], ['coupe', 'coupe'], ['wagon', 'wagon'], ['estate', 'wagon'],
  ['convertible', 'convertible'], ['cabriolet', 'convertible'], ['roadster', 'convertible'],
  ['pickup', 'pickup'], ['pickuptruck', 'pickup'], ['van', 'van'],
  ['mpv', 'mpv'], ['minivan', 'mpv'], ['multipurposepassengervehiclempv', 'mpv'],
]);

const normalizeBodyStyle = (value) => BODY_STYLE_MAP.get(normalizeKey(value)) || null;

const FUEL_TYPE_MAP = new Map([
  ['gasoline', 'petrol'], ['petrol', 'petrol'], ['diesel', 'diesel'], ['cng', 'cng'],
  ['compressednaturalgas', 'cng'], ['electric', 'electric'], ['bev', 'electric'],
  ['hybrid', 'hybrid'], ['pluginhybrid', 'hybrid'], ['phev', 'hybrid'],
]);

const normalizeFuelType = (value) => FUEL_TYPE_MAP.get(normalizeKey(value)) || null;

const normalizeYear = (value) => {
  const year = Number(value);
  return Number.isInteger(year) && year >= 1886 && year <= new Date().getFullYear() + 2 ? year : null;
};

class VehicleProviderError extends Error {
  constructor(message, { code = 'provider_error', status = null, provider = 'vehicle-provider' } = {}) {
    super(message);
    this.name = 'VehicleProviderError';
    this.code = code;
    this.status = status;
    this.provider = provider;
  }
}

const errorCodeForStatus = (status) => {
  if (status === 401) return 'invalid_key';
  if (status === 403) return 'forbidden';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'upstream_failure';
  return 'upstream_rejected';
};

const fetchJson = async ({ fetchImpl, url, headers = {}, timeoutMs, provider }) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetchImpl(url, { headers: { Accept: 'application/json', ...headers }, signal: controller.signal });
  } catch (error) {
    const timedOut = error?.name === 'AbortError';
    throw new VehicleProviderError(
      timedOut ? `${provider} request timed out` : `${provider} network request failed`,
      { code: timedOut ? 'timeout' : 'network_error', provider }
    );
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    throw new VehicleProviderError(`${provider} returned HTTP ${response.status}`, {
      code: errorCodeForStatus(response.status), status: response.status, provider,
    });
  }
  try {
    return await response.json();
  } catch {
    throw new VehicleProviderError(`${provider} returned malformed JSON`, { code: 'malformed_response', provider });
  }
};

class ApiNinjasVehicleProvider {
  constructor({
    apiKey = process.env.API_NINJAS_API_KEY,
    fetchImpl = global.fetch,
    baseUrl = 'https://api.api-ninjas.com/v2',
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = {}) {
    this.name = 'api-ninjas';
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeoutMs = timeoutMs;
    this.isRemote = true;
  }

  async request(path, params = {}) {
    if (!this.apiKey) throw new VehicleProviderError('API Ninjas key is not configured', { code: 'missing_key', provider: this.name });
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''));
    return fetchJson({
      fetchImpl: this.fetchImpl,
      url: `${this.baseUrl}${path}?${query}`,
      headers: { 'X-Api-Key': this.apiKey },
      timeoutMs: this.timeoutMs,
      provider: this.name,
    });
  }

  async facets(facets, filters = {}) {
    const payload = await this.request('/carfacets', { facets: facets.join(','), ...filters });
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new VehicleProviderError('API Ninjas returned an invalid facets payload', { code: 'malformed_response', provider: this.name });
    }
    return payload;
  }

  async getMakes() {
    const payload = await this.facets(['make']);
    if (!Array.isArray(payload.make)) throw new VehicleProviderError('API Ninjas make facet is missing', { code: 'malformed_response', provider: this.name });
    return payload.make.map((item) => canonicalMake(item?.value)).filter(Boolean);
  }

  async getModels(make) {
    const payload = await this.facets(['model'], { make });
    if (!Array.isArray(payload.model)) throw new VehicleProviderError('API Ninjas model facet is missing', { code: 'malformed_response', provider: this.name });
    const normalizedMake = canonicalMake(make);
    return payload.model.map((item) => ({
      make: normalizedMake,
      model: canonicalModel(item?.value),
      vehicleType: 'car',
      bodyStyle: null,
      fuelTypes: [],
      modelYears: [],
    })).filter((item) => item.model);
  }

  async getModelYears(make, model) {
    const payload = await this.facets(['year'], { make, model });
    if (!Array.isArray(payload.year)) throw new VehicleProviderError('API Ninjas year facet is missing', { code: 'malformed_response', provider: this.name });
    return payload.year.map((item) => normalizeYear(item?.value)).filter(Boolean).sort((a, b) => b - a);
  }

  async getModelDetails(make, model, modelYear) {
    const filters = { make, model, ...(modelYear ? { year: modelYear } : {}) };
    const payload = await this.facets(['body', 'fuel', 'year'], filters);
    const bodyItems = Array.isArray(payload.body) ? payload.body : [];
    const fuelItems = Array.isArray(payload.fuel) ? payload.fuel : [];
    const yearItems = Array.isArray(payload.year) ? payload.year : [];
    if (!bodyItems.length && !fuelItems.length && !yearItems.length) return null;
    const bodyStyles = [...new Set(bodyItems.map((item) => normalizeBodyStyle(item?.value)).filter(Boolean))];
    const fuelTypes = [...new Set(fuelItems.map((item) => normalizeFuelType(item?.value)).filter(Boolean))];
    const modelYears = [...new Set(yearItems.map((item) => normalizeYear(item?.value)).filter(Boolean))].sort((a, b) => b - a);
    const selectedYear = normalizeYear(modelYear);
    if (selectedYear && modelYears.length && !modelYears.includes(selectedYear)) return null;
    return {
      make: canonicalMake(make), model: canonicalModel(model), modelYear: selectedYear,
      vehicleType: 'car', bodyStyle: bodyStyles.length === 1 ? bodyStyles[0] : null,
      bodyStyles, fuelTypes, modelYears,
    };
  }
}

class NhtsaVehicleProvider {
  constructor({
    fetchImpl = global.fetch,
    baseUrl = 'https://vpic.nhtsa.dot.gov/api/vehicles',
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = {}) {
    this.name = 'nhtsa-vpic';
    this.fetchImpl = fetchImpl;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeoutMs = timeoutMs;
    this.isRemote = true;
  }

  async request(path) {
    const payload = await fetchJson({
      fetchImpl: this.fetchImpl,
      url: `${this.baseUrl}${path}${path.includes('?') ? '&' : '?'}format=json`,
      timeoutMs: this.timeoutMs,
      provider: this.name,
    });
    if (!payload || !Array.isArray(payload.Results)) {
      throw new VehicleProviderError('NHTSA vPIC returned an invalid result envelope', { code: 'malformed_response', provider: this.name });
    }
    return payload.Results;
  }

  async getMakes() {
    const types = ['car', 'Multipurpose Passenger Vehicle (MPV)', 'motorcycle'];
    const resultSets = await Promise.all(types.map((type) => this.request(`/GetMakesForVehicleType/${encodeURIComponent(type)}`)));
    return [...new Set(resultSets.flat().map((item) => canonicalMake(item.MakeName)).filter(Boolean))];
  }

  async getModels(make) {
    const results = await this.request(`/GetModelsForMake/${encodeURIComponent(make)}`);
    return results.map((item) => ({
      make: canonicalMake(item.Make_Name || make), model: canonicalModel(item.Model_Name),
      vehicleType: null, bodyStyle: null, fuelTypes: [], modelYears: [],
    })).filter((item) => item.model);
  }

  async getModelYears() {
    // vPIC can validate a supplied post-1995 year, but has no efficient year-list endpoint.
    return [];
  }

  async getModelDetails(make, model, modelYear) {
    const selectedYear = normalizeYear(modelYear);
    const path = selectedYear && selectedYear > 1995
      ? `/GetModelsForMakeYear/make/${encodeURIComponent(make)}/modelyear/${selectedYear}`
      : `/GetModelsForMake/${encodeURIComponent(make)}`;
    const results = await this.request(path);
    const match = results.find((item) => normalizeKey(item.Model_Name) === normalizeKey(model));
    if (!match) return null;
    const vehicleTypes = await this.request(`/GetVehicleTypesForMake/${encodeURIComponent(make)}`);
    const names = vehicleTypes.map((item) => normalizeKey(item.VehicleTypeName));
    const hasMotorcycle = names.some((name) => name.includes('motorcycle'));
    const hasPassenger = names.some((name) => name.includes('passengercar') || name.includes('multipurposepassengervehicle'));
    const vehicleType = hasMotorcycle && !hasPassenger ? 'motorcycle' : hasPassenger && !hasMotorcycle ? 'car' : null;
    return {
      make: canonicalMake(match.Make_Name || make), model: canonicalModel(match.Model_Name),
      modelYear: selectedYear, vehicleType, bodyStyle: null, bodyStyles: [],
      fuelTypes: [], modelYears: selectedYear ? [selectedYear] : [],
    };
  }
}

module.exports = {
  ApiNinjasVehicleProvider,
  NhtsaVehicleProvider,
  VehicleProviderError,
  canonicalMake,
  canonicalModel,
  normalizeBodyStyle,
  normalizeFuelType,
  normalizeKey,
  normalizeYear,
};
