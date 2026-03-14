import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { applyStorageRlsPlugin } from './vite-plugin-apply-storage-rls'

export default defineConfig({
  server: {
    host: true, // Expose on 0.0.0.0 for mobile/network access
    hmr: true,  // Explicitly enable Hot Module Replacement
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('recharts')) return 'vendor-recharts';
            if (id.includes('jspdf') || id.includes('html2canvas')) return 'vendor-pdf';
          }
        },
        chunkFileNames: 'assets/[name]-[hash].js',
      },
    },
    chunkSizeWarningLimit: 600,
  },
  plugins: [
    react(),
    tailwindcss(),
    applyStorageRlsPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // we register in main.tsx with onRegisterError so app loads when user denies SW
      includeAssets: ['favicon.ico', 'robots.txt'],
      manifest: {
        name: 'ERP',
        short_name: 'ERP',
        description: 'Enterprise ERP',
        theme_color: '#0f172a',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024, // 8 MiB (main chunk ~4 MB; Workbox default 2 MiB too low)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: 'CacheFirst',
            options: { cacheName: 'images', expiration: { maxEntries: 64 } },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: ['jspdf', 'html2canvas'],
  },
})
