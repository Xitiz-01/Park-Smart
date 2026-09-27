import { getDefaultRoute } from './authRouting';

describe('getDefaultRoute', () => {
  test('waits at login without a domain user', () => {
    expect(getDefaultRoute(null)).toBe('/login');
  });

  test.each(['admin', 'super_admin'])('routes %s to the admin area', (role) => {
    expect(getDefaultRoute({ role })).toBe('/admin');
  });

  test('routes only approved active vendors to the vendor portal', () => {
    expect(getDefaultRoute({ role: 'vendor', vendorProfile: { vendorStatus: 'active' } })).toBe('/vendor');
    expect(getDefaultRoute({ role: 'customer', vendorProfile: { vendorStatus: 'pending' } })).toBe('/vendor/status');
  });

  test('routes a regular customer to the customer dashboard', () => {
    expect(getDefaultRoute({ role: 'customer' })).toBe('/dashboard');
  });
});
