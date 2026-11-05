import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Production: com.dincouture.erp / "Din Collection"
 * Staging (side-by-side): CAP_PROFILE=stage or VITE_APP_ENV=stage → .stage bundle + "ERP Stage"
 */
const isStage =
  process.env.CAP_PROFILE === 'stage' ||
  process.env.VITE_APP_ENV === 'stage' ||
  process.env.VITE_APP_ENV === 'staging';

const config: CapacitorConfig = {
  appId: isStage ? 'com.dincouture.erp.stage' : 'com.dincouture.erp',
  appName: isStage ? 'ERP Stage' : 'Din Collection',
  webDir: 'dist',
  // Do NOT set server.url here for release APKs — bundle local dist only.
  // Dev live reload: temporarily add server.url (see CAPACITOR.md), then remove before cap sync prod.
  server: {
    cleartext: true,
    allowNavigation: ['*'],
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: isStage ? '#D97706' : '#111827',
    },
  },
};

export default config;
