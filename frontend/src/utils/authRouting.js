export const getDefaultRoute = (user) => {
  if (!user) return '/login';
  if (['admin', 'super_admin'].includes(user.role)) return '/admin';
  if (user.role === 'vendor' && user.vendorProfile?.vendorStatus === 'active') return '/vendor';
  if (user.vendorProfile) return '/vendor/status';
  return '/dashboard';
};
