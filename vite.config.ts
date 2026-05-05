import path from 'node:path'
import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import tsconfigPaths from 'vite-tsconfig-paths'

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
    tsconfigPaths({ ignoreConfigErrors: true }),
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
        enabled: true,
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
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ['**/.*'],
    },
  },
})
