import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const base = process.env.VITE_BASE || '/';
const useMlKitStub = process.env.VITE_TARGET !== 'capacitor';

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
    proxy: {
      '/auth/v1': { target: 'https://supabase.dincouture.pk', changeOrigin: true, secure: true },
      '/rest/v1': { target: 'https://supabase.dincouture.pk', changeOrigin: true, secure: true },
      '/storage/v1': { target: 'https://supabase.dincouture.pk', changeOrigin: true, secure: true },
      '/realtime/v1': {
        target: 'https://supabase.dincouture.pk',
        changeOrigin: true,
        secure: true,
        ws: true,
      },
      '/functions/v1': { target: 'https://supabase.dincouture.pk', changeOrigin: true, secure: true },
    },
  },
  build: { 
    outDir: 'dist',
    sourcemap: true, // Enable source maps for debugging
  },
});
