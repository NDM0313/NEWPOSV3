import { defineConfig } from 'vite'
import path from 'path'
import { execSync } from 'child_process'

function resolveBuildCommit(): string {
  if (process.env.VITE_BUILD_COMMIT) return process.env.VITE_BUILD_COMMIT
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'dev'
  }
}

const buildCommit = resolveBuildCommit()
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { applyStorageRlsPlugin } from './vite-plugin-apply-storage-rls'

export default defineConfig({
  define: {
    'import.meta.env.VITE_BUILD_COMMIT': JSON.stringify(buildCommit),
  },
  server: {
    host: true, // Expose on 0.0.0.0 for mobile/network access
    hmr: true,  // Explicitly enable Hot Module Replacement
    proxy: {
      // Local dev CORS bypass for self-hosted Supabase/Kong
      '/supabase': {
        target: 'https://supabase.dincouture.pk',
        changeOrigin: true,
        secure: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/supabase/, ''),
      },
    },
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('recharts') || id.includes('d3-')) return 'vendor-recharts';
            if (id.includes('jspdf') || id.includes('html2canvas')) return 'vendor-pdf';
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('date-fns') || id.includes('dayjs')) return 'vendor-date';
            if (
              id.includes('/node_modules/react/') ||
              id.includes('/node_modules/react-dom/') ||
              id.includes('/node_modules/scheduler/')
            ) {
              return 'vendor-react';
            }
            if (id.includes('sonner') || id.includes('next-themes') || id.includes('cmdk')) return 'vendor-ui';
            if (id.includes('zod') || id.includes('zustand')) return 'vendor-state';
            if (id.includes('xlsx') || id.includes('exceljs')) return 'vendor-excel';
            if (id.includes('react-beautiful-dnd') || id.includes('@dnd-kit')) return 'vendor-dnd';
          }
          // App services/contexts: Rollup default chunking (avoids circular svc/ctx chunks + boot TDZ).
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
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
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
    dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
  },
  optimizeDeps: {
    include: ['jspdf', 'html2canvas'],
  },
})
