import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Distinct from production appId so staging installs side-by-side.
  appId: 'com.dincouture.erp.stage',
  appName: 'Din Collection Stage',
  webDir: 'dist',
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
