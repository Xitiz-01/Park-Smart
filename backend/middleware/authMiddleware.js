const User = require('../models/User');
const {
  getBetterAuthSession,
  promoteBootstrapIdentity,
  syncAuthIdentityRole,
} = require('../auth/betterAuthBridge');
const { requirePermission } = require('../auth/permissions');

const bootstrapIds = () => new Set(
  (process.env.BETTER_AUTH_SUPER_ADMIN_USER_IDS || process.env.BETTER_AUTH_ADMIN_USER_IDS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
);

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
    { new: true, upsert: true, runValidators: true }
  );
  return user;
};

const authenticate = async (headers) => {
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
    const identity = await authenticate(req.headers);
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
  } catch (error) {
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
};
