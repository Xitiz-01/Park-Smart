import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Car, LayoutDashboard, MapPin, CalendarDays, ParkingSquare, Receipt,
  IndianRupee, User, Settings, LogOut, Store,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { to: '/vendor', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/vendor/locations', icon: MapPin, label: 'My Parking Locations' },
  { to: '/vendor/bookings', icon: CalendarDays, label: 'Bookings' },
  { to: '/vendor/slots', icon: ParkingSquare, label: 'Slots' },
  { to: '/vendor/transactions', icon: Receipt, label: 'Transactions' },
  { to: '/vendor/earnings', icon: IndianRupee, label: 'Earnings' },
  { to: '/vendor/profile', icon: User, label: 'Profile' },
  { to: '/vendor/settings', icon: Settings, label: 'Settings' },
];

export default function VendorLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success('Logged out');
    navigate('/login');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{
        width: 250, background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0,
      }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Car color="var(--accent)" size={24} />
            <strong>PARK<span style={{ color: 'var(--accent)' }}>SMART</span></strong>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--green)', fontSize: 12, marginTop: 8 }}>
            <Store size={13} /> Vendor Portal
          </div>
        </div>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{user?.vendorProfile?.businessName}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{user?.email}</div>
        </div>
        <nav style={{ flex: 1, padding: 12, overflowY: 'auto' }}>
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink key={to} to={to} end={end} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', marginBottom: 4,
              borderRadius: 8, fontSize: 14, color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
              background: isActive ? 'var(--accent-glow)' : 'transparent',
            })}>
              <Icon size={18} /> {label}
            </NavLink>
          ))}
        </nav>
        <div style={{ padding: 12, borderTop: '1px solid var(--border)' }}>
          <button className="app-logout-btn" onClick={handleLogout}><LogOut size={18} /> Logout</button>
        </div>
      </aside>
      <main style={{ flex: 1, minWidth: 0, background: 'var(--bg-primary)' }}>
        <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}><Outlet /></div>
      </main>
    </div>
  );
}
