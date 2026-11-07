import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

const appHtml = fileURLToPath(new URL('./app.html', import.meta.url));

/**
 * The site has two entries:
 *
 * - `/`      public landing page and published results (plain HTML in public/)
 * - `/app`   authenticated React application
 *
 * Public pages stay plain HTML so search engines see the content. Vite only
 * builds app.html; the public directory is copied verbatim. This small plugin
 * maps clean `/app/...` URLs to app.html in dev and preview, while the browser
 * keeps the URL that React Router expects.
 */
function appHtmlFallback() {
  function rewrite(req) {
    if (!req.url) return;
    const [pathname, search] = req.url.split('?');
    if (pathname === '/') {
      // The public landing page is a static file in public/. Vite's MPA mode
      // does not apply an index fallback, so map the root explicitly.
      req.url = '/index.html';
    } else if (pathname === '/app' || pathname.startsWith('/app/')) {
      req.url = `/app.html${search ? `?${search}` : ''}`;
    }
  }

  return {
    name: 'placa-app-html-fallback',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        rewrite(req);
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        rewrite(req);
        next();
      });
    },
  };
}

/**
 * The dev server proxies /api to the Express server, so the browser sees one
 * origin and the refresh cookie is sent without CORS complications.
 *
 * Phase 5 replaces the basic manifest/service worker config with the full
 * offline cache (guides, reference data, outbox).
 */
export default defineConfig({
  plugins: [
    react(),
    appHtmlFallback(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'PLACA Platform',
        short_name: 'PLACA',
        description: 'Plateau State HIV/AIDS coordination and reporting',
        theme_color: '#0f6b3f',
        background_color: '#f4f6f8',
        display: 'standalone',
        start_url: '/app/',
        scope: '/app/',
        icons: [
          {
            src: '/site/placa-pwa-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/site/placa-pwa-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // The public page is not cached as an app shell; only the signed-in
        // application uses the service worker.
        globPatterns: ['**/*.{js,css,svg,png,woff2}'],
        // Remove precache entries from older deployments so a stale shell
        // cannot point at hashed bundles that no longer exist.
        cleanupOutdatedCaches: true,
        navigateFallback: '/app.html',
        navigateFallbackAllowlist: [/^\/app(\/|$)/],
      },
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        app: appHtml,
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
