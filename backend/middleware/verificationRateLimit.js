const windows = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 30;

const verificationRateLimit = (req, res, next) => {
  const key = String(req.user?._id || req.ip || 'anonymous');
  const now = Date.now();
  if (windows.size > 10000) {
    for (const [storedKey, value] of windows) if (value.resetAt <= now) windows.delete(storedKey);
  }
  const current = windows.get(key);
  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return next();
  }
  current.count += 1;
  if (current.count > MAX_REQUESTS) {
    res.set('Retry-After', String(Math.ceil((current.resetAt - now) / 1000)));
    return res.status(429).json({ success: false, message: 'Too many verification requests. Please try again later.' });
  }
  return next();
};

module.exports = { verificationRateLimit, _windows: windows };
