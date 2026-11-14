// Keeps MongoDB's users in step with Clerk. MongoDB stays the authority on
// role and status: Clerk supplies identity (email, name, phone), and the
// sign-up intent only shapes onboarding. Role and onboarding are copied to
// Clerk's publicMetadata for UI routing, never read back for authorisation.
const User = require('../../../models/User');
const { ForbiddenError, ServiceUnavailableError, UnauthorizedError } = require('../errors');

const DUPLICATE_KEY = 11000;

const onboardingFor = (intendedRole) =>
  intendedRole === 'vendor'
    ? { intendedRole: 'vendor', state: 'vendor_applicant' }
    : { intendedRole: 'customer', state: 'complete' };

/** What the frontend may read from Clerk's publicMetadata. */
const publicMetadataFor = (user) => ({
  role: user.role,
  onboardingState: user.onboarding?.state || 'complete',
  intendedRole: user.onboarding?.intendedRole || 'customer',
});

const nameFor = (identity) => identity.name || identity.email?.split('@')[0] || 'ParkSmart user';

/** Fields Clerk owns, applied only when the data is newer than what we hold. */
const identityFields = (identity) => ({
  ...(identity.email && { email: identity.email }),
  ...(identity.name && { name: identity.name }),
  ...(identity.phone && { phone: identity.phone }),
  emailVerified: identity.emailVerified,
  ...(identity.updatedAt && { clerkUpdatedAt: new Date(identity.updatedAt) }),
});

/**
 * @param {{ provider: { updatePublicMetadata: Function }, logger?: import('pino').Logger }} deps
 * @param {import('mongoose').Document} user
 */
async function mirrorToClerk({ provider, logger }, user) {
  try {
    await provider.updatePublicMetadata(user.clerkId, publicMetadataFor(user));
  } catch (error) {
    // MongoDB already holds the truth; the mirror catches up on the next sync.
    logger?.warn({ err: error, userId: String(user._id) }, 'clerk: publicMetadata mirror failed');
  }
}

/**
 * Link an existing ParkSmart account (from Better Auth) to a Clerk user by
 * email. Only a verified email may claim an account, and an account linked
 * to one Clerk user can't be claimed by another.
 */
async function linkExisting(existing, identity) {
  if (!identity.emailVerified) {
    throw new ForbiddenError('Verify your email address to use your existing ParkSmart account');
  }
  if (existing.clerkId && existing.clerkId !== identity.id) {
    throw new ForbiddenError('This ParkSmart account is linked to a different sign-in');
  }
  const linked = await User.findOneAndUpdate(
    { _id: existing._id, $or: [{ clerkId: { $exists: false } }, { clerkId: identity.id }] },
    { $set: { clerkId: identity.id, ...identityFields(identity) } },
    { new: true, runValidators: true },
  );
  if (!linked) throw new ForbiddenError('This ParkSmart account is linked to a different sign-in');
  return linked;
}

/**
 * Apply newer identity data to an already linked user. Deleted accounts
 * stay deleted: a late update never brings them back.
 */
async function refresh(user, identity, { logger } = {}) {
  if (user.clerkDeletedAt) return user;
  const known = user.clerkUpdatedAt?.getTime();
  if (known && identity.updatedAt && identity.updatedAt <= known) return user;
  try {
    return (
      (await User.findOneAndUpdate(
        {
          _id: user._id,
          clerkDeletedAt: { $exists: false },
          $or: [{ clerkUpdatedAt: { $exists: false } }, { clerkUpdatedAt: { $lt: new Date(identity.updatedAt || 0) } }],
        },
        { $set: identityFields(identity) },
        { new: true, runValidators: true },
      )) || User.findById(user._id)
    );
  } catch (error) {
    if (error.code !== DUPLICATE_KEY) throw error;
    // The new email belongs to another ParkSmart account. Keep the old one
    // rather than merging two people's data; an admin sorts it out.
    logger?.warn({ userId: String(user._id) }, 'clerk: email change collides with another account; kept the old email');
    return user;
  }
}

/**
 * The ParkSmart user for a Clerk identity: the linked one, an existing
 * account with the same verified email, or a new customer. Safe to call
 * concurrently: the unique clerkId and email indexes decide the race, and
 * the loser reads the winner's row.
 *
 * @param {import('./clerkUser').ClerkIdentity} identity
 * @param {{ provider: object, logger?: import('pino').Logger }} deps
 * @returns {Promise<{ user: import('mongoose').Document, created: boolean }>}
 */
async function upsertFromClerk(identity, deps, attempt = 0) {
  const linked = await User.findOne({ clerkId: identity.id });
  if (linked) return { user: await refresh(linked, identity, deps), created: false };

  if (!identity.email) throw new ForbiddenError('Your sign-in has no email address');
  const existing = await User.findOne({ email: identity.email });
  if (existing) {
    const user = await linkExisting(existing, identity);
    await mirrorToClerk(deps, user);
    return { user, created: false };
  }

  try {
    const result = await User.findOneAndUpdate(
      { clerkId: identity.id },
      {
        $setOnInsert: {
          clerkId: identity.id,
          email: identity.email,
          name: nameFor(identity),
          ...(identity.phone && { phone: identity.phone }),
          emailVerified: identity.emailVerified,
          role: 'customer',
          isActive: true,
          onboarding: onboardingFor(identity.intendedRole),
          ...(identity.updatedAt && { clerkUpdatedAt: new Date(identity.updatedAt) }),
        },
      },
      { new: true, upsert: true, runValidators: true, includeResultMetadata: true },
    );
    const user = result.value;
    const created = !result.lastErrorObject?.updatedExisting;
    if (created) await mirrorToClerk(deps, user);
    return { user, created };
  } catch (error) {
    // Another request created or linked the same person first; read theirs.
    if (error.code === DUPLICATE_KEY && attempt < 2) return upsertFromClerk(identity, deps, attempt + 1);
    throw error;
  }
}

/**
 * The ParkSmart user behind a verified Clerk session, provisioning it on
 * the first request. Clerk's API is called only when the user isn't linked
 * yet, so a normal request costs one indexed MongoDB read.
 *
 * @param {string} clerkUserId
 * @param {{ provider: object, logger?: import('pino').Logger }} deps
 */
async function findOrCreateByClerkId(clerkUserId, deps) {
  const linked = await User.findOne({ clerkId: clerkUserId });
  if (linked) return linked;
  let identity;
  try {
    identity = await deps.provider.getUser(clerkUserId);
  } catch (error) {
    // A valid token for a user Clerk no longer has: treat as signed out.
    if (error.status === 404) throw new UnauthorizedError();
    deps.logger?.error({ err: error }, 'clerk: user lookup failed');
    throw new ServiceUnavailableError('Sign-in is temporarily unavailable. Try again in a minute.', { cause: error });
  }
  const { user } = await upsertFromClerk(identity, deps);
  return user;
}

/**
 * Deactivate the account of a deleted Clerk user. Bookings, payments and
 * ledger entries reference it, so the row stays.
 * @param {string} clerkUserId
 * @param {Date} deletedAt
 */
async function markDeleted(clerkUserId, deletedAt) {
  return User.findOneAndUpdate(
    { clerkId: clerkUserId, clerkDeletedAt: { $exists: false } },
    { $set: { isActive: false, clerkDeletedAt: deletedAt } },
    { new: true },
  );
}

module.exports = { findOrCreateByClerkId, upsertFromClerk, markDeleted, publicMetadataFor, onboardingFor };
