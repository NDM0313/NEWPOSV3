import { defineConfig } from 'vite';
import path from 'path';
var base = process.env.VITE_BASE || '/';
export default defineConfig({
    base: base,
    resolve: {
        alias: { '@': path.resolve(__dirname, './src') },
    },
    server: {
        port: 5174,
        host: '0.0.0.0', // Network access for mobile devices (http://YOUR_IP:5174)
        open: true,
    },
    build: { outDir: 'dist' },
});
