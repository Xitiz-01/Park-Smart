import axios from 'axios';

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  withCredentials: true,
});

// Handle 401 globally
API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

// Auth
export const authAPI = {
  getProfile: () => API.get('/account/profile'),
  updateProfile: (data) => API.put('/account/profile', data),
};

// Slots
export const slotsAPI = {
  getAll: (params) => API.get('/slots', { params }),
  getNearby: (params) => API.get('/slots/nearby', { params }),
  getExternalNearby: (params) => API.get('/slots/external-nearby', { params }),
  getById: (id) => API.get(`/slots/${id}`),
  create: (data) => API.post('/slots', data),
  update: (id, data) => API.put(`/slots/${id}`, data),
  delete: (id) => API.delete(`/slots/${id}`),
  seed: () => API.post('/slots/seed'),
};

// Bookings
export const bookingsAPI = {
  create: (data) => API.post('/bookings', data),
  getMyBookings: () => API.get('/bookings/my'),
  getAll: (params) => API.get('/bookings', { params }),
  getById: (id) => API.get(`/bookings/${id}`),
  cancel: (id) => API.put(`/bookings/${id}/cancel`),
  checkIn: (id) => API.put(`/bookings/${id}/checkin`),
  checkOut: (id) => API.put(`/bookings/${id}/checkout`),
};

export const parkingLocationsAPI = {
  getNearby: (params) => API.get('/parking-locations/nearby', { params }),
  getById: (id, params) => API.get(`/parking-locations/${id}`, { params }),
};

// Vehicles
export const vehiclesAPI = {
  getAll: () => API.get('/vehicles'),
  add: (data) => API.post('/vehicles', data),
  update: (id, data) => API.put(`/vehicles/${id}`, data),
  delete: (id) => API.delete(`/vehicles/${id}`),
};

export const vehicleCatalogAPI = {
  getBrands: (params) => API.get('/vehicle-catalog/brands', { params }),
  getModels: (params) => API.get('/vehicle-catalog/models', { params }),
  getYears: (params) => API.get('/vehicle-catalog/years', { params }),
  getDetails: (params) => API.get('/vehicle-catalog/details', { params }),
};

// Admin
export const adminAPI = {
  getDashboard: () => API.get('/admin/dashboard'),
  getUsers: () => API.get('/admin/users'),
  toggleUser: (id) => API.put(`/admin/users/${id}/toggle`),
  setUserRole: (id, role) => API.patch(`/admin/users/${id}/role`, { role }),
  getVendors: (params) => API.get('/admin/vendors', { params }),
  getVendor: (id) => API.get(`/admin/vendors/${id}`),
  approveVendor: (id) => API.patch(`/admin/vendors/${id}/approve`),
  rejectVendor: (id) => API.patch(`/admin/vendors/${id}/reject`),
  suspendVendor: (id) => API.patch(`/admin/vendors/${id}/suspend`),
};

// Vendors
export const vendorsAPI = {
  register: (data) => API.post('/vendors/register', data),
  getMyProfile: () => API.get('/vendors/me'),
  updateMyProfile: (data) => API.put('/vendors/me', data),
  getDashboard: () => API.get('/vendors/dashboard'),
  getLocations: () => API.get('/vendors/parking-locations'),
  getLocation: (id) => API.get(`/vendors/parking-locations/${id}`),
  createLocation: (data) => API.post('/vendors/parking-locations', data),
  updateLocation: (id, data) => API.patch(`/vendors/parking-locations/${id}`, data),
  deactivateLocation: (id) => API.delete(`/vendors/parking-locations/${id}`),
  getLocationSlots: (id) => API.get(`/vendors/parking-locations/${id}/slots`),
  createSlot: (id, data) => API.post(`/vendors/parking-locations/${id}/slots`, data),
  bulkCreateSlots: (id, data) => API.post(`/vendors/parking-locations/${id}/slots/bulk`, data),
  updateSlot: (slotId, data) => API.patch(`/vendors/slots/${slotId}`, data),
  getBookings: () => API.get('/vendors/bookings'),
  checkInBooking: (id) => API.put(`/vendors/bookings/${id}/checkin`),
  checkOutBooking: (id) => API.put(`/vendors/bookings/${id}/checkout`),
};

export const locationAPI = {
  autocomplete: (query) => API.get('/location/autocomplete', { params: { q: query } }),
};

export default API;
