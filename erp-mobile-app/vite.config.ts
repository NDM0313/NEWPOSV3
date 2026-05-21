import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

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

const MODULE_SCRIPT_RE =
  /<script type="module" crossorigin src="([^"]+\.js)"(?: onerror="[^"]*")?><\/script>/;

/** Surface module load failures before React mounts; keep boot watchdog before app bundle. */
function bootScriptOnErrorPlugin() {
  return {
    name: 'erp-boot-script-onerror',
    transformIndexHtml(html: string) {
      let out = html.replace(
        MODULE_SCRIPT_RE,
        '<script type="module" crossorigin src="$1" onerror="window.__ERP_SHOW_BOOT_FALLBACK&&window.__ERP_SHOW_BOOT_FALLBACK(\'App script failed to load.\')"><\/script>',
      );

      const moduleMatch = out.match(
        /<script type="module" crossorigin src="[^"]+\.js" onerror="[^"]*"><\/script>/,
      );
      if (moduleMatch) {
        const moduleTag = moduleMatch[0];
        out = out.replace(moduleTag, '');
        out = out.replace(
          /(<\/script>\s*)(\s*<\/body>)/,
          `$1\n    ${moduleTag}$2`,
        );
      }

      return out;
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isCapacitorBuild = env.VITE_TARGET === 'capacitor';
  // Capacitor release (VITE_TARGET=capacitor in .env.production): base './' + single inlined bundle for device WebView.
  const base = env.VITE_BASE || (isCapacitorBuild ? './' : '/');
  const useMlKitStub = env.VITE_TARGET !== 'capacitor';

  return {
    base,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        ...(useMlKitStub && {
          '@capacitor-mlkit/barcode-scanning': path.resolve(__dirname, './src/features/barcode/mlkit-stub.ts'),
        }),
      },
    },
    plugins: [react(), bootScriptOnErrorPlugin()],
    server: {
      port: 5174,
      host: '0.0.0.0',
      open: true,
      hmr: true,
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
      sourcemap: true,
      target: ['es2015', 'chrome87', 'safari13', 'edge88'],
      cssTarget: ['chrome87', 'safari13'],
      modulePreload: isCapacitorBuild ? false : undefined,
      rollupOptions: isCapacitorBuild
        ? { output: { inlineDynamicImports: true } }
        : undefined,
    },
  };
});
