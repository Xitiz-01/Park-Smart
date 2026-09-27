import { betterAuth } from 'better-auth';
import { toNodeHandler, fromNodeHeaders } from 'better-auth/node';
import { createAccessControl } from 'better-auth/plugins/access';
import { admin } from 'better-auth/plugins';
import { defaultStatements } from 'better-auth/plugins/admin/access';
import { mongodbAdapter } from '@better-auth/mongo-adapter';
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) throw new Error('MONGODB_URI is required for Better Auth');

const isProduction = process.env.NODE_ENV === 'production';
const crossSiteCookies = process.env.BETTER_AUTH_CROSS_SITE_COOKIES === 'true';
const splitList = (value = '') => value.split(',').map((entry) => entry.trim()).filter(Boolean);

const trustedOrigins = [...new Set([
  process.env.CLIENT_URL,
  'http://localhost:3000',
  'https://park-smart-eight.vercel.app',
  ...splitList(process.env.BETTER_AUTH_TRUSTED_ORIGINS),
].filter(Boolean))];

const mongoClient = new MongoClient(mongoUri);
const authDb = mongoClient.db();

// Better Auth's admin plugin owns account-level role/ban fields. ParkSmart's
// domain roles remain authoritative for application permissions.
const accessControl = createAccessControl(defaultStatements);
const authUserRole = accessControl.newRole({ user: [], session: [] });
const authAdminRole = accessControl.newRole({ user: ['list', 'get'], session: [] });
const authSuperAdminRole = accessControl.newRole({
  user: ['list', 'get'],
  session: ['list', 'revoke'],
});

const auth = betterAuth({
  appName: 'ParkSmart',
  baseURL: process.env.BETTER_AUTH_URL || `http://localhost:${process.env.PORT || 5000}`,
  basePath: '/api/auth',
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins,
  database: mongodbAdapter(authDb, {
    client: mongoClient,
    // Standalone MongoDB (including CI) cannot run transactions. Atlas users
    // can opt in explicitly when their deployment supports them.
    transaction: process.env.BETTER_AUTH_MONGO_TRANSACTIONS === 'true',
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    password: {
      // The legacy ParkSmart hashes are bcrypt. Keeping the same verifier lets
      // migrated users retain their passwords without plaintext resets.
      hash: (password) => bcrypt.hash(password, 12),
      verify: ({ hash, password }) => bcrypt.compare(password, hash),
    },
  },
  user: {
    additionalFields: {
      phone: { type: 'string', required: true, input: true },
    },
  },
  databaseHooks: {
    user: {
      create: {
        async before(authUser) {
          const existing = await User.findOne({ email: authUser.email.toLowerCase() });
          if (existing && !existing.authUserId) {
            throw new Error('This ParkSmart account must be migrated before it can sign in with Better Auth');
          }
          return { data: authUser };
        },
        async after(authUser) {
          const existing = await User.findOne({ email: authUser.email.toLowerCase() });
          if (existing) {
            if (existing.authUserId !== authUser.id) {
              throw new Error('ParkSmart account is already linked to another authentication identity');
            }
            return;
          }
          await User.create({
            authUserId: authUser.id,
            name: authUser.name,
            email: authUser.email,
            phone: authUser.phone,
            role: 'customer',
          });
        },
      },
    },
  },
  plugins: [
    admin({
      ac: accessControl,
      roles: {
        user: authUserRole,
        admin: authAdminRole,
        super_admin: authSuperAdminRole,
      },
      adminRoles: ['admin', 'super_admin'],
      defaultRole: 'user',
    }),
  ],
  advanced: {
    useSecureCookies: isProduction || crossSiteCookies,
    defaultCookieAttributes: {
      httpOnly: true,
      secure: isProduction || crossSiteCookies,
      sameSite: crossSiteCookies ? 'none' : 'lax',
      path: '/',
    },
  },
});

const handler = toNodeHandler(auth);

const getSession = (headers) => auth.api.getSession({ headers: fromNodeHeaders(headers) });

const setAuthUserRole = async ({ userId, role }) => {
  if (!['user', 'admin'].includes(role)) throw new Error('Unsupported Better Auth role transition');
  const id = ObjectId.isValid(userId) ? new ObjectId(userId) : userId;
  const result = await authDb.collection('user').findOneAndUpdate(
    { _id: id },
    { $set: { role, updatedAt: new Date() } },
    { returnDocument: 'after' }
  );
  if (!result) throw new Error('Better Auth user not found');
  return result;
};

const setAuthAccountActive = async (authUserId, isActive, reason = null) => {
  const id = ObjectId.isValid(authUserId) ? new ObjectId(authUserId) : authUserId;
  await authDb.collection('user').updateOne(
    { _id: id },
    {
      $set: {
        banned: !isActive,
        banReason: isActive ? null : (reason || 'Account deactivated by ParkSmart administration'),
        banExpires: null,
        updatedAt: new Date(),
      },
    }
  );
  if (!isActive) await authDb.collection('session').deleteMany({ userId: id });
};

const promoteBootstrapIdentity = async (authUserId) => {
  const id = ObjectId.isValid(authUserId) ? new ObjectId(authUserId) : authUserId;
  await authDb.collection('user').updateOne(
    { _id: id },
    { $set: { role: 'super_admin', updatedAt: new Date() } }
  );
};

const syncAuthIdentityRole = async (authUserId, domainRole) => {
  const id = ObjectId.isValid(authUserId) ? new ObjectId(authUserId) : authUserId;
  const role = ['admin', 'super_admin'].includes(domainRole) ? domainRole : 'user';
  await authDb.collection('user').updateOne(
    { _id: id, role: { $ne: role } },
    { $set: { role, updatedAt: new Date() } }
  );
};

const updateCurrentAuthUser = ({ headers, data }) => auth.api.updateUser({
  headers: fromNodeHeaders(headers),
  body: data,
});

const close = async () => mongoClient.close();

export {
  auth,
  authDb,
  handler,
  getSession,
  setAuthUserRole,
  setAuthAccountActive,
  promoteBootstrapIdentity,
  syncAuthIdentityRole,
  updateCurrentAuthUser,
  close,
};
