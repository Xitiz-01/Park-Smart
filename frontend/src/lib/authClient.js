import { createAuthClient } from 'better-auth/react';
import { adminClient } from 'better-auth/client/plugins';
import { AUTH_URL } from './env';

export const authClient = createAuthClient({
  baseURL: AUTH_URL,
  basePath: '/api/auth',
  fetchOptions: { credentials: 'include' },
  plugins: [adminClient()],
});
