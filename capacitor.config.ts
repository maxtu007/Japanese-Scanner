import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.unblur.app',
  appName: 'UnBlur',
  webDir: 'dist',
  ios: {
    contentInset: 'automatic',
  },
};

export default config;
