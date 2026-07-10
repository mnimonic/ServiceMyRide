package expo.modules.servicemyridebluetooth

import expo.modules.kotlin.exception.CodedException

internal class MissingBluetoothPermissionException :
  CodedException("Missing BLUETOOTH_CONNECT permission")
