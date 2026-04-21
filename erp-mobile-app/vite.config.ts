import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const base = process.env.VITE_BASE || '/';
const useMlKitStub = process.env.VITE_TARGET !== 'capacitor';

/** Kong may reject WS/API when forwarded Origin is localhost; set on the Node→Kong leg only. */
const supabaseProxyOrigin = process.env.VITE_SUPABASE_PROXY_ORIGIN || 'https://erp.dincouture.pk';

type ProxyWithEvents = {
  on: (event: string, fn: (...args: unknown[]) => void) => void;
};

function attachSupabaseProxyOrigin(proxy: ProxyWithEvents) {
  const setOrigin = (proxyReq: { setHeader: (n: string, v: string) => void }) => {
    proxyReq.setHeader('Origin', supabaseProxyOrigin);
  };
  proxy.on('proxyReq', (...args: unknown[]) => {
    const proxyReq = args[0] as { setHeader: (n: string, v: string) => void };
    setOrigin(proxyReq);
  });
  proxy.on('proxyReqWs', (...args: unknown[]) => {
    const proxyReq = args[0] as { setHeader: (n: string, v: string) => void };
    setOrigin(proxyReq);
  });
}

const supabaseProxy = (extra: { ws?: boolean } = {}) => ({
  target: 'https://supabase.dincouture.pk',
  changeOrigin: true,
  secure: false,
  ws: extra.ws === true,
  configure: (proxy: ProxyWithEvents) => attachSupabaseProxyOrigin(proxy),
});

export default defineConfig({
  base,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      ...(useMlKitStub && {
        '@capacitor-mlkit/barcode-scanning': path.resolve(__dirname, './src/features/barcode/mlkit-stub.ts'),
      }),
    },
  },
  server: {
    port: 5174,
    host: '0.0.0.0', // Network access for mobile devices (http://YOUR_IP:5174)
    open: true,
    hmr: true, // Explicitly enable Hot Module Replacement
    // Same-origin Supabase in dev (see src/lib/supabase.ts): avoids Kong CORS (erp.dincouture.pk only)
    // Prefix `/auth` (not only `/auth/v1`) so all auth routes are proxied.
    proxy: {
      '/auth': supabaseProxy(),
      '/rest': supabaseProxy(),
      '/storage': supabaseProxy(),
      '/realtime': supabaseProxy({ ws: true }),
      '/functions': supabaseProxy(),
    },
  },
  build: { 
    outDir: 'dist',
    sourcemap: true, // Enable source maps for debugging
  },
});
