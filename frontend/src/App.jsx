import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { LazyMotion, MotionConfig } from 'motion/react';
import { Toaster } from './components/ui/sonner';
import { ConfirmProvider } from './components/kit/ConfirmDialog';
import { TooltipProvider } from './components/ui/tooltip';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './components/theme/ThemeProvider';
import { BayLoader } from './components/kit/Loaders';

// Every screen is its own chunk, so the landing page doesn't download the
// whole app before it can paint. React Router's v7_startTransition keeps the
// current screen visible while the next one loads.
// Pages
// The landing page ships in the entry bundle: it is the first screen most
// visitors see, so it should not wait for a second round trip.
import LandingPage from './pages/LandingPage';
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));

// Customer Pages
const CustomerLayout = lazy(() => import('./components/customer/CustomerLayout'));
const CustomerDashboard = lazy(() => import('./pages/customer/Dashboard'));
const NearbyMapPage = lazy(() => import('./pages/customer/NearbyMapPage'));
const BookingPage = lazy(() => import('./pages/customer/BookingPage'));
const MyBookings = lazy(() => import('./pages/customer/MyBookings'));
const VehiclesPage = lazy(() => import('./pages/customer/VehiclesPage'));
const ProfilePage = lazy(() => import('./pages/customer/ProfilePage'));

// Admin Pages
const AdminLayout = lazy(() => import('./components/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminSlots = lazy(() => import('./pages/admin/AdminSlots'));
const AdminBookings = lazy(() => import('./pages/admin/AdminBookings'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminVendors = lazy(() => import('./pages/admin/AdminVendors'));
const AdminVerifications = lazy(() => import('./pages/admin/AdminVerifications'));

// Vendor Pages
const VendorLayout = lazy(() => import('./components/vendor/VendorLayout'));
const VendorDashboard = lazy(() => import('./pages/vendor/VendorDashboard'));
const VendorProfile = lazy(() => import('./pages/vendor/VendorProfile'));
const VendorApplication = lazy(() => import('./pages/vendor/VendorApplication'));
const VendorStatus = lazy(() => import('./pages/vendor/VendorStatus'));
const VendorPlaceholder = lazy(() => import('./pages/vendor/VendorPlaceholder'));
const ParkingLocations = lazy(() => import('./pages/vendor/ParkingLocations'));
const ParkingLocationEditor = lazy(() => import('./pages/vendor/ParkingLocationEditor'));
const VendorSlots = lazy(() => import('./pages/vendor/VendorSlots'));
const VendorBookings = lazy(() => import('./pages/vendor/VendorBookings'));
const VendorVerification = lazy(() => import('./pages/vendor/VendorVerification'));
import { getDefaultRoute } from './utils/authRouting';

// Dev-only style guide. import.meta.env.DEV is false in production builds, so
// the page and its chunk are dropped entirely.
const DesignPage = import.meta.env.DEV ? lazy(() => import('./pages/_design/DesignPage')) : null;
const loadMotionFeatures = () => import('./lib/motionFeatures').then((mod) => mod.default);

// Protected Route
const ProtectedRoute = ({ children, roles, approvedVendor = false }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={getDefaultRoute(user)} replace />;
  if (approvedVendor && user.vendorProfile?.vendorStatus !== 'active') {
    return <Navigate to="/vendor/status" replace />;
  }
  return children;
};

const AppRoutes = () => {
  const { user } = useAuth();

  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center"><BayLoader /></div>}>
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={user ? <Navigate to={getDefaultRoute(user)} /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to={getDefaultRoute(user)} /> : <RegisterPage />} />

      {/* Customer Routes */}
      <Route path="/dashboard" element={<ProtectedRoute><CustomerLayout /></ProtectedRoute>}>
        <Route index element={<CustomerDashboard />} />
        <Route path="slots" element={<Navigate to="/dashboard/nearby" replace />} />
        <Route path="nearby" element={<NearbyMapPage />} />
        <Route path="parking/:locationId" element={<BookingPage />} />
        <Route path="book/:slotId" element={<BookingPage legacy />} />
        <Route path="bookings" element={<MyBookings />} />
        <Route path="vehicles" element={<VehiclesPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      {/* Admin Routes */}
      <Route path="/admin" element={<ProtectedRoute roles={['admin', 'super_admin']}><AdminLayout /></ProtectedRoute>}>
        <Route index element={<AdminDashboard />} />
        <Route path="slots" element={<AdminSlots />} />
        <Route path="bookings" element={<AdminBookings />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="vendors" element={<AdminVendors />} />
        <Route path="verifications" element={<AdminVerifications />} />
      </Route>

      <Route path="/vendor/apply" element={<ProtectedRoute roles={['customer']}><VendorApplication /></ProtectedRoute>} />
      <Route path="/vendor/status" element={<ProtectedRoute roles={['customer', 'vendor']}><VendorStatus /></ProtectedRoute>} />
      <Route path="/vendor" element={<ProtectedRoute roles={['vendor']} approvedVendor><VendorLayout /></ProtectedRoute>}>
        <Route index element={<VendorDashboard />} />
        <Route path="locations" element={<ParkingLocations />} />
        <Route path="locations/new" element={<ParkingLocationEditor />} />
        <Route path="locations/:id/edit" element={<ParkingLocationEditor />} />
        <Route path="slots" element={<VendorSlots />} />
        <Route path="bookings" element={<VendorBookings />} />
        <Route path="profile" element={<VendorProfile />} />
        <Route path="verification" element={<VendorVerification />} />
        <Route path=":section" element={<VendorPlaceholder />} />
      </Route>

      {DesignPage && <Route path="/_design" element={<Suspense fallback={null}><DesignPage /></Suspense>} />}

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
    </Suspense>
  );
};

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ThemeProvider>
        <MotionConfig reducedMotion="user">
          <LazyMotion features={loadMotionFeatures} strict>
            <TooltipProvider delayDuration={300}>
              <ConfirmProvider>
                <AuthProvider>
                  <AppRoutes />
                  <Toaster position="top-right" />
                </AuthProvider>
              </ConfirmProvider>
            </TooltipProvider>
          </LazyMotion>
        </MotionConfig>
      </ThemeProvider>
    </Router>
  );
}

export default App;
