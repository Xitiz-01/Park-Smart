const { ObjectId } = require('mongodb');
const User = require('../models/User');

const authRoleFor = (domainRole) => (
  ['admin', 'super_admin'].includes(domainRole) ? domainRole : 'user'
);

const ensureAuthIndexes = async (db) => {
  await Promise.all([
    db.collection('user').createIndex({ email: 1 }, { unique: true, name: 'user_email_uidx' }),
    db.collection('session').createIndex({ token: 1 }, { unique: true, name: 'session_token_uidx' }),
    db.collection('session').createIndex({ userId: 1 }, { name: 'session_userId_idx' }),
    db.collection('account').createIndex({ userId: 1 }, { name: 'account_userId_idx' }),
    db.collection('verification').createIndex({ identifier: 1 }, { name: 'verification_identifier_idx' }),
  ]);
};

const migrateExistingUsers = async ({ db, dryRun = true, logger = console }) => {
  const authUsers = db.collection('user');
  const accounts = db.collection('account');
  const users = await User.find().select('+password').sort({ _id: 1 });
  const summary = { scanned: users.length, migrated: 0, linked: 0, alreadyLinked: 0, skipped: 0 };

  for (const domainUser of users) {
    const email = domainUser.email.trim().toLowerCase();
    let authUser = domainUser.authUserId
      ? await authUsers.findOne({ _id: ObjectId.isValid(domainUser.authUserId) ? new ObjectId(domainUser.authUserId) : domainUser.authUserId })
      : null;

    if (!authUser) authUser = await authUsers.findOne({ email });
    if (!authUser && !domainUser.password) {
      summary.skipped += 1;
      logger.warn(`Skipped ${email}: no legacy password hash is available`);
      continue;
    }

    const authId = authUser?._id || new ObjectId();
    const authIdString = authId.toString();
    const now = new Date();

    if (dryRun) {
      if (domainUser.authUserId === authIdString) summary.alreadyLinked += 1;
      else summary.migrated += 1;
      logger.log(`[dry-run] ${email} -> ${authIdString}`);
      continue;
    }

    await authUsers.updateOne(
      { _id: authId },
      {
        $set: {
          name: domainUser.name,
          email,
          phone: domainUser.phone,
          emailVerified: true,
          role: authRoleFor(domainUser.role),
          banned: !domainUser.isActive,
          banReason: domainUser.isActive ? null : 'Migrated inactive ParkSmart account',
          banExpires: null,
          updatedAt: now,
        },
        $setOnInsert: { image: null, createdAt: domainUser.createdAt || now },
      },
      { upsert: true }
    );

    if (domainUser.password) {
      await accounts.updateOne(
        { providerId: 'credential', accountId: authIdString },
        {
          $setOnInsert: {
            _id: new ObjectId(),
            providerId: 'credential',
            accountId: authIdString,
            userId: authId,
            password: domainUser.password,
            createdAt: domainUser.createdAt || now,
            updatedAt: now,
          },
        },
        { upsert: true }
      );
    }

    if (domainUser.authUserId === authIdString) summary.alreadyLinked += 1;
    else {
      domainUser.authUserId = authIdString;
      await domainUser.save();
      summary.linked += 1;
    }
    summary.migrated += 1;
  }

  if (!dryRun) {
    await User.collection.createIndex(
      { authUserId: 1 },
      { unique: true, sparse: true, name: 'authUserId_1' }
    );
    await ensureAuthIndexes(db);
  }
  return summary;
};

module.exports = { migrateExistingUsers, ensureAuthIndexes, authRoleFor };
