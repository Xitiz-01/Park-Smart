import React from 'react';
import { CalendarDays, LayoutDashboard, MapPin, Store, Users } from 'lucide-react';
import AppShell from '../layout/AppShell';

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Overview', end: true },
  { to: '/admin/slots', icon: MapPin, label: 'Parking Slots' },
  { to: '/admin/bookings', icon: CalendarDays, label: 'Bookings' },
  { to: '/admin/users', icon: Users, label: 'Users' },
  { to: '/admin/vendors', icon: Store, label: 'Vendor Management' },
];

export default function AdminLayout() {
  return <AppShell navItems={navItems} roleLabel="Admin control" accent="graphite" />;
}
