// Dynamic config (instead of app.json) so the Google OAuth redirect scheme can
// be derived from EXPO_PUBLIC_GOOGLE_*_CLIENT_ID in .env. Google rejects native
// redirect URIs based on the app's own package scheme ("Custom URI scheme is
// not enabled for your Android client") — native OAuth clients must redirect
// through the reversed-client-id scheme Google issues per client instead, and
// that scheme has to be registered here so the OS routes it back into the app.
function reversedClientIdScheme(clientId) {
  const suffix = '.apps.googleusercontent.com';
  if (!clientId || !clientId.endsWith(suffix)) return null;
  return `com.googleusercontent.apps.${clientId.slice(0, -suffix.length)}`;
}

const oauthSchemes = [
  reversedClientIdScheme(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID),
  reversedClientIdScheme(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID),
].filter(Boolean);

module.exports = {
  expo: {
    name: 'ServiceMyRide',
    slug: 'servicemyride',
    version: '1.0.0',
    orientation: 'portrait',
    scheme: ['servicemyride', ...oauthSchemes],
    userInterfaceStyle: 'automatic',
    icon: './assets/icon.png',
    splash: {
      resizeMode: 'contain',
      backgroundColor: '#0f172a',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.servicemyride.app',
      infoPlist: {
        NSBluetoothAlwaysUsageDescription: 'Used to detect when you are driving/riding a vehicle via its Bluetooth connection.',
        NSBluetoothPeripheralUsageDescription: 'Used to detect vehicle Bluetooth connections.',
      },
    },
    android: {
      package: 'com.servicemyride.app',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0f172a',
      },
      permissions: [
        'android.permission.BLUETOOTH',
        'android.permission.BLUETOOTH_ADMIN',
        'android.permission.BLUETOOTH_SCAN',
        'android.permission.BLUETOOTH_CONNECT',
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.POST_NOTIFICATIONS',
      ],
    },
    web: {
      bundler: 'metro',
      output: 'single',
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-router',
      'expo-notifications',
      [
        'expo-image-picker',
        {
          photosPermission: 'Used to set a photo for a vehicle.',
          cameraPermission: 'Used to take a photo of a vehicle.',
        },
      ],
      [
        'react-native-ble-plx',
        {
          isBackgroundEnabled: true,
          modes: ['peripheral', 'central'],
          bluetoothAlwaysPermission: 'Detect vehicle Bluetooth connections to log drives.',
        },
      ],
    ],
  },
};
