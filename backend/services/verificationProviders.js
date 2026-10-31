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

module.exports = {
  ProviderUnavailableError,
  ManualVerificationProvider,
  CashfreeVerificationProvider,
};
