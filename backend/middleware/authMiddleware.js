const User = require('../models/User');
const { getBetterAuthSession, promoteBootstrapIdentity, syncAuthIdentityRole } = require('../auth/betterAuthBridge');
const { requirePermission } = require('../auth/permissions');
const { bootstrapSuperAdminIds: bootstrapIds } = require('../src/config/env');
const { findOrCreateByClerkId } = require('../src/platform/auth/provisioning');

const resolveDomainUser = async (authUser) => {
  let user = await User.findOne({ authUserId: authUser.id });
  if (user) return user;

  const email = authUser.email?.toLowerCase();
  const existing = email ? await User.findOne({ email }) : null;
  if (existing) {
    if (!authUser.emailVerified) {
      const error = new Error('Existing ParkSmart account is not migrated or email identity is not verified');
      error.statusCode = 403;
      throw error;
    }
    if (existing.authUserId && existing.authUserId !== authUser.id) {
      const error = new Error('ParkSmart account is linked to a different authentication identity');
      error.statusCode = 403;
      throw error;
    }
    existing.authUserId = authUser.id;
    await existing.save();
    return existing;
  }

  // The Better Auth after-create hook normally creates this record. This
  // idempotent fallback covers an interrupted hook without duplicating users.
  user = await User.findOneAndUpdate(
    { authUserId: authUser.id },
    {
      $setOnInsert: {
        authUserId: authUser.id,
        email,
        name: authUser.name,
        phone: authUser.phone,
        role: 'customer',
        isActive: true,
      },
    },
    { new: true, upsert: true, runValidators: true },
  );
  return user;
};

/** The token from `Authorization: Bearer <token>`, or null. */
const bearerToken = (headers) => {
  const header = headers?.authorization;
  if (typeof header !== 'string') return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1] : null;
};

const authenticateWithClerk = async (token, clerk) => {
  const session = await clerk.provider.verifySessionToken(token);
  if (!session) return null;
  const user = await findOrCreateByClerkId(session.userId, clerk);
  return { authSession: { provider: 'clerk', userId: session.userId, sessionId: session.sessionId }, user };
};

/**
 * Who is making this request. Until the frontend moves to Clerk (Phase 5)
 * two sign-ins work side by side: with Clerk switched on, a Bearer token
 * is a Clerk session token and only Clerk decides it; anything else goes
 * to Better Auth's session cookie, exactly as before.
 *
 * @param {import('http').IncomingHttpHeaders} headers
 * @param {{ provider: object, logger?: object } | null} [clerk] set when Clerk is on
 */
const authenticate = async (headers, clerk = null) => {
  const token = bearerToken(headers);
  if (token && clerk?.provider) return authenticateWithClerk(token, clerk);

  const authSession = await getBetterAuthSession(headers);
  if (!authSession?.user) return null;

  const user = await resolveDomainUser(authSession.user);
  if (bootstrapIds().has(authSession.user.id) && user.role !== 'super_admin') {
    user.role = 'super_admin';
    await user.save();
    await promoteBootstrapIdentity(authSession.user.id);
  } else {
    await syncAuthIdentityRole(authSession.user.id, user.role);
  }

  return { authSession, user };
};

const protect = async (req, res, next) => {
  try {
    const identity = await authenticate(req.headers, req.app?.get('clerk'));
    if (!identity) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    if (!identity.user.isActive) {
      return res.status(403).json({ success: false, message: 'Account has been deactivated' });
    }
    req.auth = identity.authSession;
    req.user = identity.user;
    return next();
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return next(error);
  }
};

const authenticateSocket = async (socket, next) => {
  try {
    const identity = await authenticate(socket.request.headers);
    if (!identity?.user?.isActive) return next(new Error('Authentication required'));
    socket.auth = identity.authSession;
    socket.user = identity.user;
    return next();
  } catch {
    return next(new Error('Authentication required'));
  }
};

const adminOnly = requirePermission('parking:manage-all');

module.exports = {
  protect,
  requireAuth: protect,
  adminOnly,
  requirePermission,
  authenticateSocket,
  resolveDomainUser,
  authenticate,
  bearerToken,
};
