import { Platform } from 'react-native';
import { requireNativeModule, EventEmitter } from 'expo-modules-core';

let NativeModule = null;
let emitter = null;

if (Platform.OS === 'android') {
  try {
    NativeModule = requireNativeModule('ServiceMyRideBluetooth');
    emitter = new EventEmitter(NativeModule);
  } catch (e) {
    NativeModule = null;
  }
}

export function isSupported() {
  return !!NativeModule && NativeModule.isSupported();
}

export async function getBondedDevices() {
  if (!NativeModule) return [];
  return NativeModule.getBondedDevices();
}

export function startMonitoring(deviceId) {
  if (!NativeModule) return;
  NativeModule.startMonitoring(deviceId);
}

export function stopMonitoring() {
  if (!NativeModule) return;
  NativeModule.stopMonitoring();
}

export function addConnectedListener(callback) {
  if (!emitter) return { remove() {} };
  return emitter.addListener('onDeviceConnected', callback);
}

export function addDisconnectedListener(callback) {
  if (!emitter) return { remove() {} };
  return emitter.addListener('onDeviceDisconnected', callback);
}
