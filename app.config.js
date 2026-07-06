// Dynamic config (instead of app.json) so the Google OAuth redirect scheme can
// be derived from EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID in .env. iOS OAuth clients
// still redirect through the reversed-client-id scheme Google issues per
// client (e.g. com.googleusercontent.apps.<id>), so it has to be registered
// here so the OS routes it back into the app. Android no longer uses a
// redirect at all — Google removed custom-scheme redirects for Android OAuth
// clients, so Android sign-in goes through the native Play Services flow
// (@react-native-google-signin/google-signin) instead, which needs no scheme.
function reversedClientIdScheme(clientId) {
  const suffix = '.apps.googleusercontent.com';
  if (!clientId || !clientId.endsWith(suffix)) return null;
  return `com.googleusercontent.apps.${clientId.slice(0, -suffix.length)}`;
}

const oauthSchemes = [
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
    plugins: [
      'expo-router',
      'expo-notifications',
      '@react-native-google-signin/google-signin',
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
      [
        'expo-location',
        {
          locationWhenInUsePermission: 'Used to measure drive distance while a paired vehicle is connected.',
        },
      ],
    ],
  },
};
