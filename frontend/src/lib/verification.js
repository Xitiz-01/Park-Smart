// Display names for verification values. The old label() helper turned PAN,
// GSTIN, CIN and NOC into "Pan", "Gstin", "Cin" and "Noc" (audit M2).

const NAMES = {
  // categories
  IDENTITY: 'Identity', BUSINESS: 'Business', BANK: 'Bank',
  // vendor documents
  PAN: 'PAN', DRIVING_LICENCE: 'Driving licence', OTHER_IDENTITY: 'Other identity proof',
  GSTIN: 'GSTIN', CIN: 'CIN', BUSINESS_REGISTRATION: 'Business registration',
  BANK_PROOF: 'Bank proof', CANCELLED_CHEQUE: 'Cancelled cheque',
  // parking authorisation
  OWNERSHIP_PROOF: 'Ownership proof', LEASE: 'Lease', NOC: 'NOC',
  AUTHORIZATION_LETTER: 'Authorisation letter', OTHER: 'Other',
  // providers
  MANUAL: 'Manual upload', CASHFREE: 'Cashfree',
  // evidence kinds
  document: 'Vendor document', authorization: 'Parking authorisation',
  // file metadata
  originalName: 'File name', mimeType: 'File type', size: 'File size',
};

const FILE_TYPES = { 'application/pdf': 'PDF', 'image/jpeg': 'JPEG image', 'image/png': 'PNG image' };

// Evidence metadata values as people read them (sizes in KB, types by name).
export function metadataValue(key, value) {
  if (key === 'size' && Number.isFinite(Number(value))) {
    const bytes = Number(value);
    return bytes < 1024 ? `${bytes} bytes` : `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format(bytes / 1024)} KB`;
  }
  if (key === 'mimeType') return FILE_TYPES[value] || String(value);
  return String(value);
}

const ACRONYMS = new Set(['PAN', 'GSTIN', 'CIN', 'NOC', 'ID', 'KYC']);

export function verificationLabel(value) {
  if (value === undefined || value === null || value === '') return '';
  const key = String(value);
  if (NAMES[key]) return NAMES[key];
  if (NAMES[key.toUpperCase()]) return NAMES[key.toUpperCase()];
  // Unknown values (new audit actions, metadata keys): sentence case, acronyms kept.
  const words = key.replace(/([a-z])([A-Z])/g, '$1_$2').split(/[_\s]+/).filter(Boolean);
  return words.map((word, index) => {
    if (ACRONYMS.has(word.toUpperCase())) return word.toUpperCase();
    const lower = word.toLowerCase();
    return index === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
  }).join(' ');
}

export const VERIFICATION_STATUSES = ['NOT_STARTED', 'PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'RESUBMISSION_REQUIRED'];

export const DOCUMENT_TYPES = {
  IDENTITY: ['PAN', 'DRIVING_LICENCE', 'OTHER_IDENTITY'],
  BUSINESS: ['GSTIN', 'CIN', 'BUSINESS_REGISTRATION'],
  BANK: ['BANK_PROOF', 'CANCELLED_CHEQUE'],
};

export const AUTHORIZATION_TYPES = ['OWNERSHIP_PROOF', 'LEASE', 'NOC', 'AUTHORIZATION_LETTER', 'OTHER'];

// The vendor checks, in order. `key` is the field on the verification record.
export const VENDOR_CHECKS = [
  { key: 'identityStatus', label: 'Identity', copy: 'PAN, driving licence or another supported identity proof.' },
  { key: 'businessStatus', label: 'Business', copy: 'GSTIN, CIN or business registration evidence.' },
  { key: 'bankStatus', label: 'Bank', copy: 'Bank proof or a cancelled cheque, for future payouts.' },
];

// Verified-provider options shown to vendors, as data: adding or removing a
// provider is one edit here. `availability` is the key in the API's
// providerAvailability; `checks` are the identifiers it can verify in place.
export const VERIFICATION_PROVIDERS = [
  {
    id: 'cashfree',
    name: 'Cashfree Secure ID',
    availability: 'cashfree',
    checks: ['PAN', 'GSTIN'],
    summary: 'Check a PAN or GSTIN against official records straight away.',
    consent: 'I consent to this verification request.',
    unavailable: 'Not available yet: PAN and GSTIN checks will appear here once they are switched on.',
    action: 'Run check',
  },
];
