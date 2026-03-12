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
    hmr: true,      // Explicitly enable Hot Module Replacement
  },
  build: { 
    outDir: 'dist',
    sourcemap: true, // Enable source maps for debugging
  },
});
