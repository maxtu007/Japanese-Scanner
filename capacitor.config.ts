import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.unblur.app',
  appName: 'UnBlur',
  webDir: 'dist',
  ios: {
    contentInset: 'never',
  },
};

export default config;
