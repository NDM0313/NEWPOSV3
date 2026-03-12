var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
import { defineConfig } from 'vite';
import path from 'path';
var base = process.env.VITE_BASE || '/';
var useMlKitStub = process.env.VITE_TARGET !== 'capacitor';
export default defineConfig({
    base: base,
    resolve: {
        alias: __assign({ '@': path.resolve(__dirname, './src') }, (useMlKitStub && {
            '@capacitor-mlkit/barcode-scanning': path.resolve(__dirname, './src/features/barcode/mlkit-stub.ts'),
        })),
    },
    server: {
        port: 5174,
        host: '0.0.0.0', // Network access for mobile devices (http://YOUR_IP:5174)
        open: true,
        hmr: true, // Explicitly enable Hot Module Replacement
    },
    build: {
        outDir: 'dist',
        sourcemap: true, // Enable source maps for debugging
    },
});
