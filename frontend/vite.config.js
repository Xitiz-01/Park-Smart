import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Preload the fonts the first screen paints with (the display face is the
// LCP headline). Their file names are hashed, so look them up in the bundle.
const PRELOAD_FONTS = [/^bricolage-grotesque-latin-opsz-normal-.*\.woff2$/, /^geist-latin-wght-normal-.*\.woff2$/];
function preloadFonts() {
  return {
    name: 'parksmart-preload-fonts',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const files = Object.keys(ctx.bundle || {}).filter((file) => PRELOAD_FONTS.some((re) => re.test(file.split('/').pop())));
        return files.map((file) => ({
          tag: 'link',
          attrs: { rel: 'preload', as: 'font', type: 'font/woff2', href: `/${file}`, crossorigin: '' },
          injectTo: 'head-prepend',
        }));
      },
    },
  };
}

// Dev-only: where /api and /socket.io are forwarded (mirrors CRA's old "proxy").
// The redesign fixtures override it to point at their disposable backend.
const devProxyTarget = process.env.DEV_PROXY_TARGET || 'http://localhost:5001';

export default defineConfig({
  plugins: [react(), tailwindcss(), preloadFonts()],
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
    setupFiles: ['./src/test/setup.js'],
    // Node 25+ ships its own localStorage global, which hides jsdom's. Turn it
    // off in the test workers (only where Node has it) so tests see the
    // browser-like storage.
    execArgv: 'localStorage' in globalThis ? ['--no-experimental-webstorage'] : [],
  },
});
