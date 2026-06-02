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
            if (id.includes('react-dom')) return 'vendor-react-dom';
            if (id.includes('sonner') || id.includes('next-themes') || id.includes('cmdk')) return 'vendor-ui';
            if (id.includes('zod') || id.includes('zustand')) return 'vendor-state';
            if (id.includes('xlsx') || id.includes('exceljs')) return 'vendor-excel';
            if (id.includes('react-beautiful-dnd') || id.includes('@dnd-kit')) return 'vendor-dnd';
          }
          if (id.includes('/src/app/services/saleService') || id.includes('/src/app/services/saleAccountingService') || id.includes('/src/app/services/saleReturnService')) return 'svc-sales';
          if (id.includes('/src/app/services/purchaseService')) return 'svc-purchases';
          if (id.includes('/src/app/services/accountingService') || id.includes('/src/app/services/journalService') || id.includes('/src/app/services/accountingReportsService')) return 'svc-accounting';
          if (id.includes('/src/app/services/accountingIntegrityLabService') || id.includes('/src/app/services/developerAccountingDiagnosticsService') || id.includes('/src/app/services/partyBalanceTieOutService')) return 'svc-diagnostics';
          if (id.includes('/src/app/services/studioProductionService') || id.includes('/src/app/services/studioCostsService')) return 'svc-studio';
          if (id.includes('/src/app/services/customerLedgerApi')) return 'svc-ledger';
          if (id.includes('/src/app/services/')) return 'svc-core';
          if (id.includes('/src/app/context/SalesContext')) return 'ctx-sales';
          if (id.includes('/src/app/context/AccountingContext')) return 'ctx-accounting';
          if (id.includes('/src/app/context/PurchaseContext')) return 'ctx-purchases';
          if (id.includes('/src/app/context/RentalContext')) return 'ctx-rentals';
          if (id.includes('/src/app/context/ExpenseContext')) return 'ctx-expenses';
          if (id.includes('/src/app/context/ProductionContext')) return 'ctx-production';
          if (id.includes('/src/app/context/SettingsContext') || id.includes('/src/app/context/ModuleContext')) return 'ctx-settings';
          if (id.includes('/src/app/context/')) return 'ctx-core';
          if (id.includes('/src/app/lib/') || id.includes('/src/app/hooks/') || id.includes('/src/app/utils/')) return 'app-core';
          if (id.includes('/src/app/components/shared/')) return 'app-shared';
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
