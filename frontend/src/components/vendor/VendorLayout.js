import React from 'react';
import {
  CalendarDays,
  IndianRupee,
  LayoutDashboard,
  MapPin,
  ParkingSquare,
  Receipt,
  Settings,
  UserRound,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import AppShell from '../layout/AppShell';

const navItems = [
  { to: '/vendor', icon: LayoutDashboard, label: 'Overview', end: true },
  { to: '/vendor/locations', icon: MapPin, label: 'Parking Locations' },
  { to: '/vendor/bookings', icon: CalendarDays, label: 'Bookings' },
  { to: '/vendor/slots', icon: ParkingSquare, label: 'Slot Operations' },
  { to: '/vendor/transactions', icon: Receipt, label: 'Transactions' },
  { to: '/vendor/earnings', icon: IndianRupee, label: 'Earnings' },
  { to: '/vendor/profile', icon: UserRound, label: 'Business Profile' },
  { to: '/vendor/settings', icon: Settings, label: 'Settings' },
];

export default function VendorLayout() {
  const { user } = useAuth();
  return (
    <AppShell
      navItems={navItems}
      roleLabel="Vendor operations"
      accent="emerald"
      identity={{ name: user?.vendorProfile?.businessName || user?.name, subtitle: user?.email }}
    />
  );
}
