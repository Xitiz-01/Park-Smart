import React from 'react';
import {
  CalendarDays,
  CarFront,
  LayoutDashboard,
  MapPin,
  Navigation,
  Store,
  UserRound,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import AppShell from '../layout/AppShell';

export default function CustomerLayout() {
  const { user } = useAuth();
  const vendorItem = user?.vendorProfile
    ? {
        to: user.role === 'vendor' && user.vendorProfile.vendorStatus === 'active' ? '/vendor' : '/vendor/status',
        icon: Store,
        label: user.role === 'vendor' ? 'Vendor Portal' : 'Vendor Application',
      }
    : { to: '/vendor/apply', icon: Store, label: 'Become a Vendor' };

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Overview', end: true },
    { to: '/dashboard/slots', icon: MapPin, label: 'Find Parking' },
    { to: '/dashboard/nearby', icon: Navigation, label: 'Nearby Map' },
    { to: '/dashboard/bookings', icon: CalendarDays, label: 'My Bookings' },
    { to: '/dashboard/vehicles', icon: CarFront, label: 'My Vehicles' },
    { to: '/dashboard/profile', icon: UserRound, label: 'Profile' },
    vendorItem,
  ];

  return <AppShell navItems={navItems} roleLabel="Driver workspace" accent="emerald" />;
}
