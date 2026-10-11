const crypto = require('crypto');
const { maskIdentifier } = require('./redactionService');

class ProviderUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProviderUnavailableError';
    this.statusCode = 503;
  }
}

class ManualVerificationProvider {
  isConfigured() { return true; }
  normalizeSubmission() { return { provider: 'MANUAL', status: 'UNDER_REVIEW' }; }
}

class CashfreeVerificationProvider {
  constructor(options = {}) {
    this.enabled = options.enabled ?? process.env.CASHFREE_VERIFY_ENABLED === 'true';
    this.clientId = options.clientId ?? process.env.CASHFREE_CLIENT_ID;
    this.clientSecret = options.clientSecret ?? process.env.CASHFREE_CLIENT_SECRET;
    this.baseUrl = (options.baseUrl ?? process.env.CASHFREE_VERIFY_BASE_URL ?? 'https://sandbox.cashfree.com/verification').replace(/\/$/, '');
    this.fetch = options.fetch ?? global.fetch;
  }

  isConfigured() { return Boolean(this.enabled && this.clientId && this.clientSecret); }

  async request(endpoint, payload) {
    if (!this.isConfigured()) throw new ProviderUnavailableError('Cashfree verification is not configured');
    try {
      const response = await this.fetch(`${this.baseUrl}/${endpoint}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-client-id': this.clientId, 'x-client-secret': this.clientSecret },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new ProviderUnavailableError('Cashfree verification is temporarily unavailable');
      return result;
    } catch (error) {
      if (error instanceof ProviderUnavailableError) throw error;
      throw new ProviderUnavailableError('Cashfree verification is temporarily unavailable');
    }
  }

  async verifyPan({ identifier, name }) {
    const result = await this.request('pan', { pan: identifier, name });
    return {
      provider: 'CASHFREE', documentType: 'PAN', category: 'IDENTITY',
      status: result.valid === true ? 'VERIFIED' : 'REJECTED',
      providerReference: String(result.reference_id || ''),
      safeMetadata: { maskedIdentifier: maskIdentifier(identifier), registeredName: result.registered_name, panType: result.type, nameMatch: result.name_match_result },
    };
  }

  async verifyGstin({ identifier, businessName }) {
    const result = await this.request('gstin', { GSTIN: identifier, business_name: businessName });
    const valid = result.valid === true || result.status === 'VALID' || result.gstin_status === 'Active';
    return {
      provider: 'CASHFREE', documentType: 'GSTIN', category: 'BUSINESS',
      status: valid ? 'VERIFIED' : 'REJECTED',
      providerReference: String(result.reference_id || ''),
      safeMetadata: { maskedIdentifier: maskIdentifier(identifier), legalName: result.legal_name_of_business, tradeName: result.trade_name_of_business, gstinStatus: result.gstin_status },
    };
  }
}

class DigiLockerProvider {
  constructor(options = {}) {
    this.enabled = options.enabled ?? process.env.DIGILOCKER_ENABLED === 'true';
    this.clientId = options.clientId ?? process.env.DIGILOCKER_CLIENT_ID;
    this.clientSecret = options.clientSecret ?? process.env.DIGILOCKER_CLIENT_SECRET;
    this.redirectUri = options.redirectUri ?? process.env.DIGILOCKER_REDIRECT_URI;
    this.authorizationUrl = options.authorizationUrl ?? process.env.DIGILOCKER_AUTHORIZATION_URL;
    this.tokenUrl = options.tokenUrl ?? process.env.DIGILOCKER_TOKEN_URL;
    this.documentsUrl = options.documentsUrl ?? process.env.DIGILOCKER_DOCUMENTS_URL;
    this.fetch = options.fetch ?? global.fetch;
  }

  isConfigured() {
    return Boolean(this.enabled && this.clientId && this.clientSecret && this.redirectUri && this.authorizationUrl && this.tokenUrl && this.documentsUrl);
  }

  createAuthorizationUrl(state) {
    if (!this.isConfigured()) throw new ProviderUnavailableError('DigiLocker requester access is not configured');
    const url = new URL(this.authorizationUrl);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('redirect_uri', this.redirectUri);
    url.searchParams.set('state', state);
    return url.toString();
  }

  async exchangeCode(code) {
    if (!this.isConfigured()) throw new ProviderUnavailableError('DigiLocker requester access is not configured');
    const response = await this.fetch(this.tokenUrl, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, grant_type: 'authorization_code', client_id: this.clientId, client_secret: this.clientSecret, redirect_uri: this.redirectUri }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.access_token) throw new ProviderUnavailableError('DigiLocker authorization could not be completed');
    return result.access_token;
  }

  async fetchDocuments(accessToken) {
    const response = await this.fetch(this.documentsUrl, { headers: { authorization: `Bearer ${accessToken}` } });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new ProviderUnavailableError('DigiLocker documents could not be retrieved');
    const rows = result.items || result.documents || result.files || [];
    return rows.map((item) => ({
      provider: 'DIGILOCKER',
      documentType: this.mapDocumentType(item),
      category: this.mapCategory(item),
      status: 'VERIFIED',
      providerReference: String(item.uri || item.id || ''),
      safeMetadata: { name: String(item.name || item.description || 'Verified document').slice(0, 160), issuer: String(item.issuer || item.issuerName || '').slice(0, 160), issuedAt: item.date || item.issuedAt },
    })).filter((document) => document.documentType);
  }

  mapDocumentType(item) {
    const value = `${item.type || ''} ${item.name || ''} ${item.description || ''}`.toLowerCase();
    if (value.includes('pan')) return 'PAN';
    if (value.includes('driving') || value.includes('licence') || value.includes('license')) return 'DRIVING_LICENCE';
    if (value.includes('gst')) return 'GSTIN';
    if (value.includes('incorporation') || value.includes('cin')) return 'CIN';
    return null;
  }

  mapCategory(item) {
    return ['GSTIN', 'CIN'].includes(this.mapDocumentType(item)) ? 'BUSINESS' : 'IDENTITY';
  }

  static generateState() { return crypto.randomBytes(32).toString('base64url'); }
  static hashState(state) { return crypto.createHash('sha256').update(String(state)).digest('hex'); }
}

module.exports = {
  ProviderUnavailableError,
  ManualVerificationProvider,
  CashfreeVerificationProvider,
  DigiLockerProvider,
};
