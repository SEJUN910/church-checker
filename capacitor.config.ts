import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.churchchecker.app',
  appName: 'Church Checker',
  webDir: 'www',
  server: {
    url: 'https://church-checker.vercel.app',
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#2563eb",
      showSpinner: false,
    },
  },
};

export default config;
