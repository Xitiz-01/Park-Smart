import React from 'react';
import { CalendarDays, LayoutDashboard, MapPin, ShieldCheck, Store, Users } from 'lucide-react';
import AppShell from '../layout/AppShell';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Overview', end: true },
  { to: '/admin/slots', icon: MapPin, label: 'Parking Slots' },
  { to: '/admin/bookings', icon: CalendarDays, label: 'Bookings' },
  { to: '/admin/users', icon: Users, label: 'Users' },
  { to: '/admin/vendors', icon: Store, label: 'Vendor Management' },
  { to: '/admin/verifications', icon: ShieldCheck, label: 'Verification Review' },
];

export default function AdminLayout() {
  const { isSuperAdmin } = useAuth();
  return <AppShell navItems={navItems} roleLabel={isSuperAdmin ? 'Super Admin control' : 'Admin control'} accent="graphite" />;
}
