import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Dev-only: where /api and /socket.io are forwarded (mirrors CRA's old "proxy").
// The redesign fixtures override it to point at their disposable backend.
const devProxyTarget = process.env.DEV_PROXY_TARGET || 'http://localhost:5001';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // REACT_APP_* stays readable so existing Vercel settings keep working.
  envPrefix: ['VITE_', 'REACT_APP_'],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': { target: devProxyTarget, changeOrigin: true },
      '/socket.io': { target: devProxyTarget, changeOrigin: true, ws: true },
    },
  },
  preview: { port: 3000 },
  build: { outDir: 'build' },
  test: {
    globals: true,
    environment: 'jsdom',
  },
});
