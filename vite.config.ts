import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Vivi's Dance Lab is a static, offline-first PWA and its own app next to Athletic Lab and Dad Lab:
// its own manifest id, start URL and service-worker scope (the BASE_PATH), its own icon, and its own
// IndexedDB database name ("dance-lab"). Nothing here touches the other apps.
const base = process.env.BASE_PATH || '/';
const appName = process.env.APP_NAME || 'Dance Lab';
const themeColor = '#783a6e';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        name: appName,
        short_name: 'Dance Lab',
        id: base,
        description: 'Flexibility, body-weight strength, balance and healthy habits for a young dancer, offline-first',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: themeColor,
        theme_color: themeColor,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: base + 'index.html',
        cleanupOutdatedCaches: true
      }
    })
  ],
  define: { __APP_NAME__: JSON.stringify(appName) },
  build: { target: 'es2020', sourcemap: false },
  test: { environment: 'node', include: ['tests/**/*.test.ts'], setupFiles: ['tests/setup.ts'] }
} as any);
