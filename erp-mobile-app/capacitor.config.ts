import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dincouture.erp',
  appName: 'Din Collection',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      launchShowDuration: 0,
      backgroundColor: '#111827',
    },
  },
};

export default config;
