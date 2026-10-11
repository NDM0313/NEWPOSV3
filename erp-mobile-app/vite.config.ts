import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

type ProxyWithEvents = {
  on: (event: string, fn: (...args: unknown[]) => void) => void;
};

type ProxyReqLike = {
  setHeader: (n: string, v: string) => void;
  path?: string;
};

function apikeyFromProxyPath(path: string | undefined): string | null {
  if (!path) return null;
  const q = path.indexOf('?');
  if (q === -1) return null;
  return new URLSearchParams(path.slice(q + 1)).get('apikey');
}

function buildSupabaseProxy(opts: {
  targetHost: string;
  origin: string;
  ws?: boolean;
}) {
  let wsProxyLogOnce = false;
  const attach = (proxy: ProxyWithEvents) => {
    const setCommonHeaders = (proxyReq: ProxyReqLike) => {
      proxyReq.setHeader('Origin', opts.origin);
      proxyReq.setHeader('Host', opts.targetHost);
    };
    proxy.on('proxyReq', (...args: unknown[]) => {
      const proxyReq = args[0] as ProxyReqLike;
      setCommonHeaders(proxyReq);
    });
    proxy.on('proxyReqWs', (...reqArgs: unknown[]) => {
      const proxyReq = reqArgs[0] as ProxyReqLike;
      const req = reqArgs[3] as { url?: string } | undefined;
      setCommonHeaders(proxyReq);
      const apikey = apikeyFromProxyPath(req?.url ?? proxyReq.path);
      if (apikey) proxyReq.setHeader('apikey', apikey);
      if (!wsProxyLogOnce) {
        wsProxyLogOnce = true;
        console.info(`[Vite] Realtime WS proxy → ${opts.targetHost}`);
      }
    });
    proxy.on('error', (...args: unknown[]) => {
      const err = args[0] as { message?: string };
      console.warn('[Vite] Supabase proxy error:', err?.message ?? err);
    });
  };
  return {
    target: `https://${opts.targetHost}`,
    changeOrigin: true,
    secure: false,
    ws: opts.ws === true,
    configure: attach,
  };
}

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

  // Staging anon key against production Kong returns plain "Unauthorized" (not JSON).
  // When .env points at api-stage, proxy there too (native still uses resolveSupabaseApiUrl).
  const envUrl = String(env.VITE_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '');
  const useStageProxy = /api-stage\.ndmcore\.com/i.test(envUrl);
  const proxyHost = useStageProxy ? 'api-stage.ndmcore.com' : 'api.ndmcore.com';
  const proxyOrigin =
    env.VITE_SUPABASE_PROXY_ORIGIN ||
    process.env.VITE_SUPABASE_PROXY_ORIGIN ||
    (useStageProxy ? 'https://erp-stage.ndmcore.com' : 'https://erp.ndmcore.com');
  if (useStageProxy) {
    console.info(`[Vite] Dev Supabase proxy → https://${proxyHost} (staging)`);
  }
  const supabaseProxy = (extra: { ws?: boolean } = {}) =>
    buildSupabaseProxy({ targetHost: proxyHost, origin: proxyOrigin, ws: extra.ws });

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
        : {
            output: {
              manualChunks(id) {
                if (!id.includes('node_modules')) return;
                if (id.includes('@supabase')) return 'vendor-supabase';
                if (id.includes('jspdf') || id.includes('html2canvas')) return 'vendor-pdf';
                if (id.includes('lucide-react')) return 'vendor-icons';
                if (
                  id.includes('/react/') ||
                  id.includes('/react-dom/') ||
                  id.includes('/scheduler/')
                ) {
                  return 'vendor-react';
                }
              },
            },
          },
    },
  };
});
