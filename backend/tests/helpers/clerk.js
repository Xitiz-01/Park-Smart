// Shared fixtures for the Clerk tests: users shaped like Clerk's Backend SDK
// and webhook payloads, and webhook deliveries signed the way Svix signs.
const crypto = require('node:crypto');

// A Svix signing secret is "whsec_" + base64 key bytes.
const SIGNING_SECRET = `whsec_${Buffer.from('parksmart-clerk-webhook-test-key').toString('base64')}`;

const clerkUser = (
  id,
  { email = `${id}@example.com`, verified = true, intendedRole, updatedAt = 1000, ...rest } = {},
) => ({
  id,
  emailAddresses: [
    { id: `email_${id}`, emailAddress: email, verification: { status: verified ? 'verified' : 'unverified' } },
  ],
  primaryEmailAddressId: `email_${id}`,
  firstName: 'Test',
  lastName: id,
  unsafeMetadata: intendedRole === undefined ? {} : { intendedRole },
  updatedAt,
  ...rest,
});

const webhookUser = (raw) => ({
  id: raw.id,
  email_addresses: raw.emailAddresses.map((entry) => ({
    id: entry.id,
    email_address: entry.emailAddress,
    verification: entry.verification,
  })),
  primary_email_address_id: raw.primaryEmailAddressId,
  first_name: raw.firstName,
  last_name: raw.lastName,
  unsafe_metadata: raw.unsafeMetadata,
  updated_at: raw.updatedAt,
});

/** Sign like Svix: base64 HMAC-SHA256 over "<id>.<timestamp>.<body>". */
const signedDelivery = (
  payload,
  { id = `msg_${crypto.randomUUID()}`, timestamp = Math.floor(Date.now() / 1000), secret = SIGNING_SECRET } = {},
) => {
  const body = JSON.stringify(payload);
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const signature = crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64');
  return {
    body,
    headers: {
      'svix-id': id,
      'svix-timestamp': String(timestamp),
      'svix-signature': `v1,${signature}`,
      'content-type': 'application/json',
    },
  };
};

const event = (type, data, timestamp = Date.now()) => ({ type, data, object: 'event', timestamp });

module.exports = { SIGNING_SECRET, clerkUser, webhookUser, signedDelivery, event };
