import {
  CalendarDays, CarFront, IndianRupee, LayoutDashboard, MapPin, Navigation, ParkingSquare, Plus,
  Receipt, Settings, ShieldCheck, Store, UserRound, Users,
} from 'lucide-react';

// One navigation source for the sidebar, the mobile tab bar, breadcrumbs and
// the command menu. `tab: true` puts an item in the driver's bottom tab bar.

export function customerWorkspace(user) {
  const vendorItem = user?.vendorProfile
    ? {
      to: user.role === 'vendor' && user.vendorProfile.vendorStatus === 'active' ? '/vendor' : '/vendor/status',
      icon: Store,
      label: user.role === 'vendor' ? 'Operator workspace' : 'Operator application',
    }
    : { to: '/vendor/apply', icon: Store, label: 'List your parking' };

  return {
    id: 'driver',
    label: 'Driver',
    home: '/dashboard',
    profile: '/dashboard/profile',
    nav: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Overview', end: true, tab: true },
      { to: '/dashboard/nearby', icon: Navigation, label: 'Find parking', tab: true },
      { to: '/dashboard/bookings', icon: CalendarDays, label: 'My bookings', tab: true },
      { to: '/dashboard/vehicles', icon: CarFront, label: 'My vehicles', tab: true },
      { to: '/dashboard/profile', icon: UserRound, label: 'Profile' },
      vendorItem,
    ],
    // Sub-pages that are not in the nav but need a breadcrumb.
    crumbs: [
      { prefix: '/dashboard/parking/', parent: '/dashboard/nearby', label: 'Reserve' },
      { prefix: '/dashboard/book/', parent: '/dashboard/nearby', label: 'Reserve' },
    ],
    actions: [
      { to: '/dashboard/nearby', icon: Navigation, label: 'Open the nearby map' },
      { to: '/dashboard/vehicles', icon: CarFront, label: 'Manage vehicles' },
      { to: '/dashboard/bookings', icon: CalendarDays, label: 'Booking history' },
    ],
  };
}

export function vendorWorkspace() {
  return {
    id: 'operator',
    label: 'Operator',
    home: '/vendor',
    profile: '/vendor/profile',
    nav: [
      { to: '/vendor', icon: LayoutDashboard, label: 'Overview', end: true },
      { to: '/vendor/locations', icon: MapPin, label: 'Parking locations' },
      { to: '/vendor/bookings', icon: CalendarDays, label: 'Bookings' },
      { to: '/vendor/slots', icon: ParkingSquare, label: 'EV bays' },
      { to: '/vendor/transactions', icon: Receipt, label: 'Transactions' },
      { to: '/vendor/earnings', icon: IndianRupee, label: 'Earnings' },
      { to: '/vendor/profile', icon: UserRound, label: 'Business profile' },
      { to: '/vendor/verification', icon: ShieldCheck, label: 'Verification' },
      { to: '/vendor/settings', icon: Settings, label: 'Settings' },
    ],
    crumbs: [
      { prefix: '/vendor/locations/new', parent: '/vendor/locations', label: 'New location' },
      { prefix: '/vendor/locations/', parent: '/vendor/locations', label: 'Edit location' },
    ],
    actions: [
      { to: '/vendor/locations/new', icon: Plus, label: 'Add a parking location' },
      { to: '/vendor/locations', icon: MapPin, label: 'Parking locations' },
      { to: '/vendor/bookings', icon: CalendarDays, label: 'Incoming bookings' },
      { to: '/vendor/slots', icon: ParkingSquare, label: 'EV bay inventory' },
    ],
  };
}

// Admins have no profile page of their own (the account menu just signs out).
export function adminWorkspace({ isSuperAdmin = false } = {}) {
  return {
    id: 'admin',
    label: isSuperAdmin ? 'Super admin' : 'Admin',
    home: '/admin',
    nav: [
      { to: '/admin', icon: LayoutDashboard, label: 'Overview', end: true },
      { to: '/admin/bookings', icon: CalendarDays, label: 'Bookings' },
      { to: '/admin/users', icon: Users, label: 'Users' },
      { to: '/admin/vendors', icon: Store, label: 'Vendors' },
      { to: '/admin/verifications', icon: ShieldCheck, label: 'Verification review' },
      { to: '/admin/slots', icon: ParkingSquare, label: 'Tracked bays' },
    ],
    crumbs: [],
    actions: [
      { to: '/admin/vendors?status=pending', icon: Store, label: 'Review vendor applications' },
      { to: '/admin/verifications', icon: ShieldCheck, label: 'Open verification cases' },
      { to: '/admin/bookings?status=upcoming', icon: CalendarDays, label: 'Upcoming bookings' },
    ],
  };
}

const matches = (item, pathname) => (item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`));

// Breadcrumb trail for a path: workspace home, then the nav item, then a
// sub-page label when the path is deeper than the nav.
export function breadcrumbsFor(workspace, pathname) {
  const trail = [{ to: workspace.home, label: workspace.nav[0].label }];
  const crumb = workspace.crumbs.find((entry) => pathname.startsWith(entry.prefix));
  const item = crumb
    ? workspace.nav.find((navItem) => navItem.to === crumb.parent)
    : [...workspace.nav].sort((a, b) => b.to.length - a.to.length).find((navItem) => matches(navItem, pathname));
  if (item && item.to !== workspace.home) trail.push({ to: item.to, label: item.label });
  if (crumb) trail.push({ label: crumb.label });
  return trail;
}
