import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dincouture.erp',
  appName: 'Din Collection',
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
      backgroundColor: '#111827',
    },
  },
};

export default config;
