import { Platform, PermissionsAndroid } from 'react-native';
import * as ServiceMyRideBluetooth from '../../modules/servicemyride-bluetooth';

// Bluetooth drive-detection.
//
// How it works: each vehicle can be associated with a Bluetooth device the
// phone is ALREADY paired with at the OS level (car head unit, helmet
// intercom, scooter dongle, etc - the user pairs it once via system
// Bluetooth settings, same as pairing for calls/music). We never scan for or
// initiate our own connection to a device; we only watch the OS-level
// Classic Bluetooth connection state (ACL link) for a device the user picks
// from their phone's already-paired list. When that link comes up we
// consider the vehicle "in use" and open a drive session; when it drops we
// close the session and log the tracked distance.
//
// Android only: most vehicle Bluetooth is Classic Bluetooth (HFP/A2DP/SPP),
// and completing a new Classic Bluetooth pairing from a third-party app
// isn't possible on either platform - it must already exist in the phone's
// Bluetooth settings. iOS additionally gives third-party apps no public API
// to enumerate already-paired Classic Bluetooth accessories or observe their
// connection state (Apple restricts that to MFi-certified accessories via
// ExternalAccessory), so this feature is unavailable there; iOS users log
// drives manually.

export function isSupported() {
  return Platform.OS === 'android' && ServiceMyRideBluetooth.isSupported();
}

// BLUETOOTH_CONNECT is a dangerous permission on Android 12+ (API 31+) and
// needs a runtime grant, or bonded-device lookups/connection state throw.
// Below API 31, BLUETOOTH is a normal permission granted at install time.
async function ensurePermissions() {
  if (Platform.OS !== 'android') return true;
  if (Platform.Version < 31) return true;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

// Lists devices already paired with this phone at the OS level, for the user
// to pick which one represents this vehicle. Throws if unsupported or if
// permission is denied.
export async function listPairedDevices() {
  if (!isSupported()) {
    throw new Error('Bluetooth vehicle detection is only available on a physical Android device.');
  }
  const granted = await ensurePermissions();
  if (!granted) {
    throw new Error('Bluetooth permission was denied.');
  }
  return ServiceMyRideBluetooth.getBondedDevices();
}

// Monitor connection state of a specific paired device id. onConnect/
// onDisconnect fire as the vehicle's Bluetooth comes in and out of range.
// Returns an unsubscribe function.
export function monitorDevice(deviceId, { onConnect, onDisconnect }) {
  if (!isSupported() || !deviceId) return () => {};

  let connectedSub = null;
  let disconnectedSub = null;
  let stopped = false;

  ensurePermissions().then((granted) => {
    if (stopped || !granted) return;
    connectedSub = ServiceMyRideBluetooth.addConnectedListener((e) => {
      if (e?.id === deviceId) onConnect && onConnect();
    });
    disconnectedSub = ServiceMyRideBluetooth.addDisconnectedListener((e) => {
      if (e?.id === deviceId) onDisconnect && onDisconnect();
    });
    ServiceMyRideBluetooth.startMonitoring(deviceId);
  });

  return () => {
    stopped = true;
    ServiceMyRideBluetooth.stopMonitoring();
    connectedSub && connectedSub.remove();
    disconnectedSub && disconnectedSub.remove();
  };
}
