import path from 'node:path'
import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365
const FONT_CACHE_OPTIONS = {
  expiration: { maxEntries: 10, maxAgeSeconds: ONE_YEAR_IN_SECONDS } as const,
  cacheableResponse: { statuses: [0, 200] },
}

const fontCache = (cacheName: string, urlPattern: RegExp) =>
  ({
    urlPattern,
    handler: 'CacheFirst',
    options: { cacheName, ...FONT_CACHE_OPTIONS },
  }) as const

const runtimeCaching = [
  fontCache('google-fonts-cache', /^https:\/\/fonts\.googleapis\.com\/.*/i),
  fontCache('gstatic-fonts-cache', /^https:\/\/fonts\.gstatic\.com\/.*/i),
]

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    runtimeErrorOverlay(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackAllowlist: [/^\/(?!api\/|login|callback)/],
        runtimeCaching,
      },
      devOptions: {
        // SW is never active in dev — main.tsx unregisters any stale SW on non-PROD load.
        enabled: false,
      },
    }),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer(),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  root: path.resolve(import.meta.dirname, 'client'),
  resolve: {
    tsconfigPaths: true,
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    // workbox-window is only discovered when the PWA service worker runs in
    // the browser, not during the initial module-graph crawl. Pre-including it
    // prevents Vite from triggering a mid-session full-page reload + re-bundle
    // which can land two React instances in the module graph simultaneously.
    include: ['workbox-window'],
  },
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'react-vendor',
              test: /\/(react|react-dom|scheduler|wouter)\//g,
            },
            {
              name: 'radix-ui-vendor',
              test: /\/@radix-ui\//g,
            },
            {
              name: 'dnd-kit-vendor',
              test: /\/@dnd-kit\//g,
            },
            {
              name: 'framer-motion-vendor',
              test: /\/framer-motion\//g,
            },
            {
              name: 'api-vendor',
              test: /\/@ts-rest\//g,
            },
            {
              name: 'forms-vendor',
              test: /\/(react-hook-form|@hookform\/resolvers|zod|zod-validation-error)\//g,
            },
            {
              name: 'icons-vendor',
              test: /\/(lucide-react|react-icons)\//g,
            },
          ],
        },
      },
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ['**/.*'],
    },
  },
})
