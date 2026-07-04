import { Platform } from 'react-native';

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

// Scan for nearby/known devices so the user can pick one to associate.
// Returns an unsubscribe function. Emits {id, name} for each discovered device.
export function scanForDevices(onDevice, onError) {
  const mgr = getManager();
  if (!mgr) {
    onError && onError(new Error('Bluetooth not available on this platform'));
    return () => {};
  }
  const seen = new Set();
  const sub = mgr.onStateChange((state) => {
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

  return () => {
    try {
      mgr.stopDeviceScan();
      sub.remove();
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

  poll = setInterval(check, 15000);
  check();

  return () => poll && clearInterval(poll);
}

export function destroy() {
  if (manager) {
    try { manager.destroy(); } catch (e) {}
    manager = null;
  }
}
