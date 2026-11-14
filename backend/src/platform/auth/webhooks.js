// POST /api/v1/webhooks/clerk: Clerk's user events, delivered by Svix.
//
// - The signature is checked over the raw body (express.raw, mounted
//   before the JSON parser), with Clerk's own verifier. A wrong signature,
//   or a timestamp more than five minutes off (a replay), is a 400.
// - Delivery is at least once and unordered. Each svix-id is recorded
//   before the event is applied, so a repeat is acknowledged and skipped;
//   if applying fails the record is removed and Svix retries later.
//   Updates carry Clerk's updated_at, and older data never overwrites
//   newer (see provisioning.js).
const express = require('express');
const ClerkWebhookEvent = require('../../../models/ClerkWebhookEvent');
const { ForbiddenError, ServiceUnavailableError, ValidationError } = require('../errors');
const { normalizeClerkUser } = require('./clerkUser');
const { markDeleted, upsertFromClerk } = require('./provisioning');

const DUPLICATE_KEY = 11000;
const HANDLED = new Set(['user.created', 'user.updated', 'user.deleted']);

/**
 * Apply one verified event.
 * @param {{ type: string, data: Record<string, any>, timestamp?: number }} event
 * @param {{ provider: object, logger?: import('pino').Logger }} deps
 */
async function applyEvent(event, deps) {
  if (event.type === 'user.deleted') {
    // Deleted objects carry no updated_at; the event's own time stands in.
    await markDeleted(event.data.id, new Date(event.timestamp || Date.now()));
    return;
  }
  await upsertFromClerk(normalizeClerkUser(event.data), deps);
}

/**
 * @param {() => ({ provider: object, logger?: import('pino').Logger, signingSecret?: string } | null)} getClerk
 *   read per request, so tests and config changes take effect without a rebuild
 */
function clerkWebhookRouter(getClerk) {
  const router = express.Router();
  router.post('/', express.raw({ type: 'application/json', limit: '512kb' }), async (req, res, next) => {
    const clerk = getClerk();
    if (!clerk?.provider || !clerk.signingSecret) {
      return next(new ServiceUnavailableError('Clerk webhooks are not configured'));
    }

    let event;
    try {
      event = await clerk.provider.verifyWebhook(req);
    } catch {
      return next(new ValidationError('Webhook signature verification failed'));
    }

    const svixId = req.get('svix-id');
    if (!HANDLED.has(event.type)) return res.json({ received: true, ignored: event.type });

    try {
      await ClerkWebhookEvent.create({ svixId, type: event.type, clerkUserId: event.data?.id });
    } catch (error) {
      if (error.code === DUPLICATE_KEY) return res.json({ received: true, duplicate: true });
      return next(error);
    }

    try {
      await applyEvent(event, clerk);
    } catch (error) {
      if (error instanceof ForbiddenError) {
        // An identity conflict (say, an unverified email that matches an
        // existing account) won't resolve on retry. Acknowledge and log;
        // the person's first sign-in reports it to them.
        clerk.logger?.warn({ type: event.type, svixId, reason: error.message }, 'clerk: webhook event skipped');
        return res.json({ received: true, skipped: true });
      }
      await ClerkWebhookEvent.deleteOne({ svixId }).catch(() => {});
      clerk.logger?.error({ err: error, type: event.type, svixId }, 'clerk: webhook event failed; Svix will retry');
      return next(error);
    }
    clerk.logger?.info({ type: event.type, svixId }, 'clerk: webhook event applied');
    return res.json({ received: true });
  });
  return router;
}

module.exports = { clerkWebhookRouter, applyEvent };
