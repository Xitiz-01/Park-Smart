let runtimePromise;

const runtime = () => {
  if (!runtimePromise) runtimePromise = import('./betterAuth.mjs');
  return runtimePromise;
};

const betterAuthHandler = async (req, res, next) => {
  try {
    const { handler } = await runtime();
    return handler(req, res);
  } catch (error) {
    return next(error);
  }
};

const getBetterAuthSession = async (headers) => (await runtime()).getSession(headers);
const setAuthUserRole = async (options) => (await runtime()).setAuthUserRole(options);
const setAuthAccountActive = async (...args) => (await runtime()).setAuthAccountActive(...args);
const promoteBootstrapIdentity = async (...args) => (await runtime()).promoteBootstrapIdentity(...args);
const syncAuthIdentityRole = async (...args) => (await runtime()).syncAuthIdentityRole(...args);
const updateCurrentAuthUser = async (options) => (await runtime()).updateCurrentAuthUser(options);
const closeBetterAuth = async () => {
  if (runtimePromise) await (await runtimePromise).close();
};

module.exports = {
  betterAuthHandler,
  getBetterAuthSession,
  setAuthUserRole,
  setAuthAccountActive,
  promoteBootstrapIdentity,
  syncAuthIdentityRole,
  updateCurrentAuthUser,
  closeBetterAuth,
};
