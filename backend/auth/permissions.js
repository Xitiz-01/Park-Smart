const ROLE_PERMISSIONS = Object.freeze({
  customer: Object.freeze([
    'parking:read',
    'booking:create',
    'booking:read-own',
    'booking:cancel-own',
    'vehicle:manage-own',
    'vendor:apply',
  ]),
  vendor: Object.freeze([
    'parking:read',
    'booking:create',
    'booking:read-own',
    'booking:cancel-own',
    'vehicle:manage-own',
    'parking:create',
    'parking:update-own',
    'slot:manage-own',
    'booking:read-vendor',
    'booking:manage-vendor',
  ]),
  admin: Object.freeze([
    'parking:read',
    'vendor:approve',
    'user:list',
    'user:set-status',
    'booking:read-all',
    'booking:manage-all',
    'parking:manage-all',
  ]),
  super_admin: Object.freeze([
    'parking:read',
    'vendor:approve',
    'user:list',
    'user:set-status',
    'user:set-admin-role',
    'booking:read-all',
    'booking:manage-all',
    'parking:manage-all',
    'admin:create',
    'admin:remove',
  ]),
});

const hasPermission = (userOrRole, permission) => {
  const role = typeof userOrRole === 'string' ? userOrRole : userOrRole?.role;
  return Boolean(role && ROLE_PERMISSIONS[role]?.includes(permission));
};

const requirePermission = (permission) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  if (!hasPermission(req.user, permission)) {
    return res.status(403).json({ success: false, message: `Missing permission: ${permission}` });
  }
  next();
};

module.exports = { ROLE_PERMISSIONS, hasPermission, requirePermission };
