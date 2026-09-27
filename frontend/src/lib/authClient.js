import { createAuthClient } from 'better-auth/react';
import { adminClient } from 'better-auth/client/plugins';

const configuredApiUrl = process.env.REACT_APP_API_URL || '/api';
const inferredBackendOrigin = configuredApiUrl.startsWith('http')
  ? configuredApiUrl.replace(/\/api\/?$/, '')
  : window.location.origin;

export const authClient = createAuthClient({
  baseURL: process.env.REACT_APP_AUTH_URL || inferredBackendOrigin,
  basePath: '/api/auth',
  fetchOptions: { credentials: 'include' },
  plugins: [adminClient()],
});
