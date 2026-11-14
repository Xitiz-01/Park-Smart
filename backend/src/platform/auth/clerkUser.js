// Clerk describes a user in two shapes: the Backend SDK's User (camelCase)
// and the webhook payload (snake_case). Both become one plain object here,
// so provisioning never cares where the data came from.

const SIGN_UP_ROLES = new Set(['customer', 'vendor']);

/**
 * The role someone asked for at sign-up. `unsafeMetadata` is written by the
 * browser, so only "customer" and "vendor" are honoured; anything else,
 * admin roles included, becomes "customer".
 * @param {unknown} value
 * @returns {'customer'|'vendor'}
 */
const signUpIntent = (value) => (SIGN_UP_ROLES.has(value) ? value : 'customer');

const pick = (raw, camel, snake) => (raw[camel] !== undefined ? raw[camel] : raw[snake]);

const toMillis = (value) => {
  if (value === undefined || value === null) return undefined;
  const ms = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(ms) ? ms : undefined;
};

/**
 * @typedef {object} ClerkIdentity
 * @property {string} id Clerk user id (user_…)
 * @property {string|undefined} email primary email, lower-cased
 * @property {boolean} emailVerified whether Clerk has verified that email
 * @property {string|undefined} name
 * @property {string|undefined} phone primary phone number
 * @property {'customer'|'vendor'} intendedRole sanitised sign-up intent
 * @property {number|undefined} updatedAt Clerk's updated_at, in ms
 */

/**
 * @param {Record<string, any>} raw a Backend SDK User or a webhook `data` object
 * @returns {ClerkIdentity}
 */
function normalizeClerkUser(raw) {
  if (!raw || typeof raw.id !== 'string') throw new TypeError('A Clerk user needs an id');
  const emails = pick(raw, 'emailAddresses', 'email_addresses') || [];
  const primaryEmailId = pick(raw, 'primaryEmailAddressId', 'primary_email_address_id');
  const primaryEmail = emails.find((entry) => entry.id === primaryEmailId) || emails[0];
  const address = primaryEmail && pick(primaryEmail, 'emailAddress', 'email_address');

  const phones = pick(raw, 'phoneNumbers', 'phone_numbers') || [];
  const primaryPhoneId = pick(raw, 'primaryPhoneNumberId', 'primary_phone_number_id');
  const primaryPhone = phones.find((entry) => entry.id === primaryPhoneId) || phones[0];

  const name = [pick(raw, 'firstName', 'first_name'), pick(raw, 'lastName', 'last_name')]
    .filter((part) => typeof part === 'string' && part.trim())
    .join(' ')
    .trim();
  const unsafeMetadata = pick(raw, 'unsafeMetadata', 'unsafe_metadata') || {};

  return {
    id: raw.id,
    email: typeof address === 'string' ? address.trim().toLowerCase() : undefined,
    emailVerified: primaryEmail?.verification?.status === 'verified',
    name: name || undefined,
    phone: primaryPhone ? pick(primaryPhone, 'phoneNumber', 'phone_number') : undefined,
    intendedRole: signUpIntent(unsafeMetadata.intendedRole),
    updatedAt: toMillis(pick(raw, 'updatedAt', 'updated_at')),
  };
}

module.exports = { normalizeClerkUser, signUpIntent };
