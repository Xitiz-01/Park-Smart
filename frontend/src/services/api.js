import axios from 'axios';

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
});

// Attach token to every request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally
API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Auth
export const authAPI = {
  register: (data) => API.post('/auth/register', data),
  login: (data) => API.post('/auth/login', data),
  getProfile: () => API.get('/auth/profile'),
  updateProfile: (data) => API.put('/auth/profile', data),
  changePassword: (data) => API.put('/auth/change-password', data),
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

// Vehicles
export const vehiclesAPI = {
  getAll: () => API.get('/vehicles'),
  add: (data) => API.post('/vehicles', data),
  update: (id, data) => API.put(`/vehicles/${id}`, data),
  delete: (id) => API.delete(`/vehicles/${id}`),
};

// Admin
export const adminAPI = {
  getDashboard: () => API.get('/admin/dashboard'),
  getUsers: () => API.get('/admin/users'),
  toggleUser: (id) => API.put(`/admin/users/${id}/toggle`),
};

export default API;
