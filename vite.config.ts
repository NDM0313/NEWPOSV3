import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { applyStorageRlsPlugin } from './vite-plugin-apply-storage-rls'

export default defineConfig({
  server: {
    host: true, // Expose on 0.0.0.0 for mobile/network access
  },
  plugins: [
    react(),
    tailwindcss(),
    applyStorageRlsPlugin(),
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
