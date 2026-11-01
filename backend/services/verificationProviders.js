const { maskIdentifier } = require('./redactionService');
const { getConfig } = require('../src/config/env');

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
    const defaults = getConfig().cashfree;
    this.enabled = options.enabled ?? defaults.enabled;
    this.clientId = options.clientId ?? defaults.clientId;
    this.clientSecret = options.clientSecret ?? defaults.clientSecret;
    this.baseUrl = (options.baseUrl ?? defaults.baseUrl).replace(/\/$/, '');
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

  /**
   * Bank Account Verification, Sync V2 (POST /bank-account/sync). A valid
   * account whose holder name is a direct or good partial match is verified;
   * a valid account with a weaker or missing name match goes to manual
   * review; an invalid account is rejected. Only the last four digits of the
   * account number are kept.
   * @param {{ accountNumber: string, ifsc: string, name: string }} input
   */
  async verifyBankAccount({ accountNumber, ifsc, name }) {
    const result = await this.request('bank-account/sync', { bank_account: accountNumber, ifsc, name });
    const valid = result.account_status === 'VALID';
    const nameMatched = ['DIRECT_MATCH', 'GOOD_PARTIAL_MATCH'].includes(result.name_match_result);
    return {
      provider: 'CASHFREE', documentType: 'BANK_ACCOUNT', category: 'BANK',
      status: !valid ? 'REJECTED' : nameMatched ? 'VERIFIED' : 'UNDER_REVIEW',
      providerReference: String(result.reference_id || ''),
      safeMetadata: {
        maskedIdentifier: maskIdentifier(accountNumber),
        ifsc,
        bankName: result.bank_name || result.ifsc_details?.bank,
        nameAtBank: result.name_at_bank,
        nameMatchResult: result.name_match_result,
        accountStatusCode: result.account_status_code,
      },
    };
  }
}

module.exports = {
  ProviderUnavailableError,
  ManualVerificationProvider,
  CashfreeVerificationProvider,
};
