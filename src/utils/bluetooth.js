import { Platform, PermissionsAndroid } from 'react-native';

// Bluetooth drive-detection.
//
// How it works: each vehicle can be paired with a Bluetooth device id
// (e.g. the car's handsfree/head-unit, or a helmet intercom / scooter dongle).
// When that device connects, we consider the vehicle "in use" and open a drive
// session; when it disconnects we close the session and can prompt to log km.
//
// On web, BLE is unavailable, so this module degrades to a no-op with manual
// drive logging still available in the UI.

let BleManager = null;
let manager = null;

function getManager() {
  if (Platform.OS === 'web') return null;
  if (manager) return manager;
  try {
    // Lazy require so web bundling doesn't choke on native module.
    const { BleManager: BM } = require('react-native-ble-plx');
    BleManager = BM;
    manager = new BleManager();
  } catch (e) {
    manager = null;
  }
  return manager;
}

export function isSupported() {
  return Platform.OS !== 'web' && !!getManager();
}

// Declaring BLUETOOTH_SCAN/CONNECT/ACCESS_FINE_LOCATION in the manifest isn't
// enough on Android 6+ - they're dangerous permissions that also need a
// runtime grant, or ble-plx throws "Device is not authorized to use
// BluetoothLE" on every scan/connect. iOS has no equivalent step (CoreBluetooth
// prompts on first use from the Info.plist strings already set in app.config.js).
async function ensurePermissions() {
  if (Platform.OS !== 'android') return true;
  const perms = Platform.Version >= 31
    ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]
    : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  const results = await PermissionsAndroid.requestMultiple(perms);
  return perms.every((p) => results[p] === PermissionsAndroid.RESULTS.GRANTED);
}

// Scan for nearby/known devices so the user can pick one to associate.
// Returns an unsubscribe function. Emits {id, name} for each discovered device.
export function scanForDevices(onDevice, onError) {
  const mgr = getManager();
  if (!mgr) {
    onError && onError(new Error('Bluetooth not available on this platform'));
    return () => {};
  }
  const seen = new Set();
  let sub = null;
  let stopped = false;

  ensurePermissions().then((granted) => {
    if (stopped) return;
    if (!granted) {
      onError && onError(new Error('Bluetooth permission was denied'));
      return;
    }
    sub = mgr.onStateChange((state) => {
      if (state === 'PoweredOn') {
        mgr.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
          if (error) {
            onError && onError(error);
            return;
          }
          if (device && !seen.has(device.id)) {
            seen.add(device.id);
            onDevice({ id: device.id, name: device.name || device.localName || 'Unknown' });
          }
        });
      }
    }, true);
  });

  return () => {
    stopped = true;
    try {
      mgr.stopDeviceScan();
      sub && sub.remove();
    } catch (e) {}
  };
}

// Monitor connection state of a specific device id. onConnect/onDisconnect
// fire as the paired device comes and goes. Returns unsubscribe fn.
export function monitorDevice(deviceId, { onConnect, onDisconnect }) {
  const mgr = getManager();
  if (!mgr || !deviceId) return () => {};

  let poll = null;
  let connected = false;
  let stopped = false;

  async function check() {
    try {
      const isConn = await mgr.isDeviceConnected(deviceId);
      if (isConn && !connected) {
        connected = true;
        onConnect && onConnect();
      } else if (!isConn && connected) {
        connected = false;
        onDisconnect && onDisconnect();
      }
    } catch (e) {}
  }

  ensurePermissions().then((granted) => {
    if (stopped || !granted) return;
    poll = setInterval(check, 15000);
    check();
  });

  return () => {
    stopped = true;
    poll && clearInterval(poll);
  };
}

export function destroy() {
  if (manager) {
    try { manager.destroy(); } catch (e) {}
    manager = null;
  }
}
