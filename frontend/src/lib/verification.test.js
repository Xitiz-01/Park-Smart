import { VERIFICATION_PROVIDERS, metadataValue, verificationLabel } from './verification';

test('acronyms survive (audit M2)', () => {
  expect(verificationLabel('PAN')).toBe('PAN');
  expect(verificationLabel('GSTIN')).toBe('GSTIN');
  expect(verificationLabel('NOC')).toBe('NOC');
  expect(verificationLabel('DRIVING_LICENCE')).toBe('Driving licence');
  expect(verificationLabel('IDENTITY')).toBe('Identity');
});

test('unknown values fall back to sentence case with acronyms kept', () => {
  expect(verificationLabel('DOCUMENT_SUBMITTED')).toBe('Document submitted');
  expect(verificationLabel('PAN_VERIFIED')).toBe('PAN verified');
  expect(verificationLabel('panNumber')).toBe('PAN number');
  expect(verificationLabel('')).toBe('');
});

test('providers are plain data with unique ids, and DigiLocker is gone', () => {
  expect(VERIFICATION_PROVIDERS.map((provider) => provider.id)).toEqual(['cashfree']);
  const ids = VERIFICATION_PROVIDERS.map((provider) => provider.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const provider of VERIFICATION_PROVIDERS) {
    expect(provider.checks.length).toBeGreaterThan(0);
    expect(provider.consent).toBeTruthy();
  }
});

test('file metadata reads naturally', () => {
  expect(verificationLabel('mimeType')).toBe('File type');
  expect(metadataValue('mimeType', 'application/pdf')).toBe('PDF');
  expect(metadataValue('size', 125)).toBe('125 bytes');
  expect(metadataValue('size', 2048)).toBe('2 KB');
  expect(metadataValue('originalName', 'pan.pdf')).toBe('pan.pdf');
});
