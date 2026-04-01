declare module 'virtual:pwa-register' {
  export function registerSW(options?: unknown): void;
}

declare module 'react-dom/client' {
  export const createRoot: any;
  export const hydrateRoot: any;
}

interface ImportMetaEnv {
  readonly DEV?: boolean;
  readonly MODE?: string;
  readonly PROD?: boolean;
  readonly SSR?: boolean;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly NEXT_PUBLIC_SUPABASE_URL?: string;
  readonly NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  readonly NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY?: string;
  readonly VITE_ENABLE_LOGGING?: string;
  readonly VITE_GITHUB_TOKEN?: string;
  readonly VITE_ACCOUNTING_STRICT_LEGACY?: string;
  readonly VITE_ACCOUNTING_LEGACY_HARD_FAIL?: string;
  readonly VITE_ACCOUNTING_DEBUG_SOURCES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
