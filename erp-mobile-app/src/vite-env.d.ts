/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** When `"true"` together with dev mode, shows Connection Debug and verbose sync logs. */
  readonly VITE_SHOW_ERP_DEV_TOOLS?: string;
  readonly VITE_DISABLE_REALTIME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
