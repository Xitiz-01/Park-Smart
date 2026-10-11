// The one place that reads build-time configuration. The REACT_APP_* names are
// kept from the CRA days so existing .env files and Vercel settings still work.
const env = import.meta.env;

export const API_URL = env.REACT_APP_API_URL || '/api';

// An absolute API URL names the backend; a relative one means same-origin
// (the Vite dev proxy, or a frontend domain that proxies /api).
const backendOrigin = /^https?:\/\//.test(API_URL)
  ? API_URL.replace(/\/api\/?$/, '')
  : window.location.origin;

export const AUTH_URL = env.REACT_APP_AUTH_URL || backendOrigin;
export const SOCKET_URL = env.REACT_APP_SOCKET_URL || backendOrigin;
