// Identity providers. The rest of the backend talks to an AuthProvider and
// never imports Clerk directly, so tests and CI run against the fake one
// without Clerk keys or network access.
//
// interface AuthProvider {
//   name: 'clerk' | 'fake'
//   verifySessionToken(token): Promise<{ userId, sessionId } | null>
//   getUser(userId): Promise<ClerkIdentity>
//   updatePublicMetadata(userId, metadata): Promise<void>
//   verifyWebhook(req): Promise<WebhookEvent>   (throws when the signature is wrong)
// }
const crypto = require('node:crypto');
const { createClerkClient, verifyToken } = require('@clerk/express');
const { verifyWebhook } = require('@clerk/express/webhooks');
const { normalizeClerkUser } = require('./clerkUser');

/**
 * Claims of a usable session token, or null. Pending sessions (sign-up
 * tasks still open) count as signed out, as Clerk's own helpers do.
 */
const sessionFromClaims = (claims) => {
  if (!claims || typeof claims.sub !== 'string') return null;
  if (claims.sts === 'pending') return null;
  return { userId: claims.sub, sessionId: typeof claims.sid === 'string' ? claims.sid : undefined };
};

/**
 * @param {import('../../config/env').Config['clerk']} clerk
 * @param {{ logger?: import('pino').Logger }} [options]
 */
function createClerkAuthProvider(clerk, { logger } = {}) {
  const client = createClerkClient({
    secretKey: clerk.secretKey,
    publishableKey: clerk.publishableKey,
    telemetry: { disabled: true },
  });
  return {
    name: 'clerk',
    async verifySessionToken(token) {
      try {
        const claims = await verifyToken(token, {
          secretKey: clerk.secretKey,
          jwtKey: clerk.jwtKey,
          authorizedParties: clerk.authorizedParties.length ? clerk.authorizedParties : undefined,
        });
        return sessionFromClaims(claims);
      } catch (error) {
        // Expired, malformed or foreign tokens are an ordinary 401.
        logger?.debug({ reason: error.reason || error.message }, 'clerk: session token rejected');
        return null;
      }
    },
    async getUser(userId) {
      return normalizeClerkUser(await client.users.getUser(userId));
    },
    async updatePublicMetadata(userId, publicMetadata) {
      await client.users.updateUserMetadata(userId, { publicMetadata });
    },
    verifyWebhook(req) {
      return verifyWebhook(req, { signingSecret: clerk.webhookSigningSecret });
    },
  };
}

/**
 * In-memory stand-in for tests and CI. Tokens are random strings it issued
 * itself; there is no way to mint one from outside the process. Webhooks
 * are checked with Clerk's real verifier, against a test signing secret.
 *
 * @param {{ nodeEnv?: string, webhookSigningSecret?: string }} [options]
 */
function createFakeAuthProvider({ nodeEnv = process.env.NODE_ENV, webhookSigningSecret } = {}) {
  if (nodeEnv === 'production') throw new Error('The fake auth provider must never run in production');
  const users = new Map();
  const sessions = new Map();
  const metadataUpdates = [];
  return {
    name: 'fake',
    metadataUpdates,
    /** Add or replace a user; `raw` is shaped like a Backend SDK User. */
    addUser(raw) {
      users.set(raw.id, raw);
      return normalizeClerkUser(raw);
    },
    /** Issue a session token for a known user. */
    signIn(userId, { pending = false } = {}) {
      if (!users.has(userId)) throw new Error(`fake auth: unknown user ${userId}`);
      const token = `fake_${crypto.randomBytes(18).toString('base64url')}`;
      sessions.set(token, {
        sub: userId,
        sid: `sess_${crypto.randomBytes(6).toString('hex')}`,
        sts: pending ? 'pending' : 'active',
      });
      return token;
    },
    signOut(token) {
      sessions.delete(token);
    },
    async verifySessionToken(token) {
      return sessionFromClaims(sessions.get(token));
    },
    async getUser(userId) {
      const raw = users.get(userId);
      if (!raw) throw Object.assign(new Error(`fake auth: unknown user ${userId}`), { status: 404 });
      return normalizeClerkUser(raw);
    },
    async updatePublicMetadata(userId, publicMetadata) {
      metadataUpdates.push({ userId, publicMetadata });
    },
    verifyWebhook(req) {
      return verifyWebhook(req, { signingSecret: webhookSigningSecret });
    },
  };
}

/**
 * The provider for this config, or null while Clerk is switched off.
 * @param {import('../../config/env').Config} config
 * @param {{ logger?: import('pino').Logger }} [options]
 */
function createAuthProvider(config, options = {}) {
  if (!config.clerk.enabled) return null;
  if (config.clerk.provider === 'fake') {
    return createFakeAuthProvider({
      nodeEnv: config.nodeEnv,
      webhookSigningSecret: config.clerk.webhookSigningSecret,
    });
  }
  return createClerkAuthProvider(config.clerk, options);
}

module.exports = { createAuthProvider, createClerkAuthProvider, createFakeAuthProvider, sessionFromClaims };
