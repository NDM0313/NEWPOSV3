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
      // Local dev CORS bypass for self-hosted Supabase/Kong.
      // Default: production Mini PC API (api.ndmcore.com). Override with VITE_SUPABASE_PROXY_ORIGIN
      // if pointing at a different Kong (must match VITE_SUPABASE_ANON_KEY issuer).
      '/supabase': (() => {
        const proxyOrigin = (
          process.env.VITE_SUPABASE_PROXY_ORIGIN ||
          process.env.VITE_SUPABASE_URL ||
          'https://api.ndmcore.com'
        ).replace(/\/$/, '')
        let proxyHost = 'api.ndmcore.com'
        let browserOrigin = 'https://erp.ndmcore.com'
        try {
          proxyHost = new URL(proxyOrigin).host
          if (/ndmcore\.com$/i.test(proxyHost)) browserOrigin = 'https://erp.ndmcore.com'
          else if (/dincouture\.pk$/i.test(proxyHost)) browserOrigin = 'https://erp.dincouture.pk'
          else browserOrigin = proxyOrigin
        } catch {
          /* keep defaults */
        }
        return {
          target: proxyOrigin,
          changeOrigin: true,
          secure: true,
          ws: true,
          timeout: 120000,
          proxyTimeout: 120000,
          rewrite: (path: string) => path.replace(/^\/supabase/, ''),
          configure: (proxy: {
            on: (event: string, fn: (...args: unknown[]) => void) => void
          }) => {
            // Kong may reject when Origin is localhost; set Host/Origin on the Node→Kong leg only.
            const setUpstreamHeaders = (proxyReq: { setHeader: (n: string, v: string) => void }) => {
              proxyReq.setHeader('Host', proxyHost)
              proxyReq.setHeader('Origin', browserOrigin)
              // Cloudflare bot rules (error 1010) reject bare Node clients without a browser UA.
              proxyReq.setHeader(
                'User-Agent',
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              )
            }
            proxy.on('proxyReq', (...args: unknown[]) => {
              setUpstreamHeaders(args[0] as { setHeader: (n: string, v: string) => void })
            })
            proxy.on('proxyReqWs', (...args: unknown[]) => {
              setUpstreamHeaders(args[0] as { setHeader: (n: string, v: string) => void })
            })
            proxy.on('error', (...args: unknown[]) => {
              const err = args[0] as { message?: string } | undefined
              console.warn('[Vite] /supabase proxy error:', err?.message ?? err)
            })
          },
        }
      })(),
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
