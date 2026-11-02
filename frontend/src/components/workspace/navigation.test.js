import { adminWorkspace, breadcrumbsFor, customerWorkspace, vendorWorkspace } from './navigation';

const labels = (trail) => trail.map((crumb) => crumb.label);

test('driver breadcrumbs follow the nav and name sub-pages', () => {
  const driver = customerWorkspace({ role: 'customer' });
  expect(labels(breadcrumbsFor(driver, '/dashboard'))).toEqual(['Overview']);
  expect(labels(breadcrumbsFor(driver, '/dashboard/bookings'))).toEqual(['Overview', 'My bookings']);
  expect(labels(breadcrumbsFor(driver, '/dashboard/parking/abc'))).toEqual(['Overview', 'Find parking', 'Reserve']);
});

test('operator breadcrumbs cover new and edit location pages', () => {
  const operator = vendorWorkspace();
  expect(labels(breadcrumbsFor(operator, '/vendor/locations/new'))).toEqual(['Overview', 'Parking locations', 'New location']);
  expect(labels(breadcrumbsFor(operator, '/vendor/locations/abc/edit'))).toEqual(['Overview', 'Parking locations', 'Edit location']);
  expect(labels(breadcrumbsFor(operator, '/vendor/slots'))).toEqual(['Overview', 'EV bays']);
});

test('the driver tab bar keeps four destinations and the vendor link adapts to status', () => {
  expect(customerWorkspace({ role: 'customer' }).nav.filter((item) => item.tab)).toHaveLength(4);
  expect(customerWorkspace({ role: 'customer' }).nav.at(-1).to).toBe('/vendor/apply');
  expect(customerWorkspace({ role: 'customer', vendorProfile: { vendorStatus: 'pending' } }).nav.at(-1).to).toBe('/vendor/status');
  expect(customerWorkspace({ role: 'vendor', vendorProfile: { vendorStatus: 'active' } }).nav.at(-1).to).toBe('/vendor');
});

test('admin workspace names the role and has no profile page', () => {
  expect(adminWorkspace().label).toBe('Admin');
  expect(adminWorkspace({ isSuperAdmin: true }).label).toBe('Super admin');
  expect(adminWorkspace().profile).toBeUndefined();
  expect(labels(breadcrumbsFor(adminWorkspace(), '/admin/verifications'))).toEqual(['Overview', 'Verification review']);
});
