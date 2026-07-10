package expo.modules.servicemyridebluetooth

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import androidx.core.content.ContextCompat
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val EVENT_CONNECTED = "onDeviceConnected"
private const val EVENT_DISCONNECTED = "onDeviceDisconnected"

// Detects OS-level Classic Bluetooth connections (ACL link up/down) to a
// device the phone already paired with in system Bluetooth settings - e.g. a
// car head unit, helmet intercom or scooter dongle. This deliberately does
// NOT scan for or initiate its own BLE/RFCOMM connection: most vehicle
// Bluetooth is Classic (HFP/A2DP/SPP), and the pairing itself must already
// exist at the OS level, since a third-party app can't complete Classic
// Bluetooth pairing/bonding on Android without OS UI.
class ServiceMyRideBluetoothModule : Module() {
  private var receiver: BroadcastReceiver? = null
  private var monitoredAddress: String? = null

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val adapter: BluetoothAdapter?
    get() = (context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter

  override fun definition() = ModuleDefinition {
    Name("ServiceMyRideBluetooth")

    Events(EVENT_CONNECTED, EVENT_DISCONNECTED)

    Function("isSupported") {
      adapter != null
    }

    Function("getBondedDevices") {
      val bonded = try {
        adapter?.bondedDevices
      } catch (e: SecurityException) {
        throw MissingBluetoothPermissionException()
      }
      (bonded ?: emptySet()).map { device ->
        mapOf("id" to device.address, "name" to (safeName(device) ?: device.address))
      }
    }

    Function("startMonitoring") { deviceAddress: String ->
      stopMonitoringInternal()
      monitoredAddress = deviceAddress

      val filter = IntentFilter().apply {
        addAction(BluetoothDevice.ACTION_ACL_CONNECTED)
        addAction(BluetoothDevice.ACTION_ACL_DISCONNECTED)
      }
      val r = object : BroadcastReceiver() {
        override fun onReceive(ctx: Context, intent: Intent) {
          val device = extractDevice(intent) ?: return
          if (device.address != monitoredAddress) return
          when (intent.action) {
            BluetoothDevice.ACTION_ACL_CONNECTED -> sendEvent(EVENT_CONNECTED, mapOf("id" to device.address))
            BluetoothDevice.ACTION_ACL_DISCONNECTED -> sendEvent(EVENT_DISCONNECTED, mapOf("id" to device.address))
          }
        }
      }
      // Bluetooth ACL broadcasts come from the system Bluetooth process, not
      // this app, so they require RECEIVER_EXPORTED on API 33+ - see
      // https://developer.android.com/develop/background-work/background-tasks/broadcasts#context-registered-receivers
      ContextCompat.registerReceiver(context, r, filter, ContextCompat.RECEIVER_EXPORTED)
      receiver = r

      // ACL broadcasts only fire on the next transition, so if the device is
      // already connected when monitoring starts, report that now.
      if (isCurrentlyConnected(deviceAddress)) {
        sendEvent(EVENT_CONNECTED, mapOf("id" to deviceAddress))
      }
    }

    Function("stopMonitoring") {
      stopMonitoringInternal()
    }

    OnDestroy {
      stopMonitoringInternal()
    }
  }

  private fun stopMonitoringInternal() {
    receiver?.let {
      try {
        context.unregisterReceiver(it)
      } catch (e: IllegalArgumentException) {
        // already unregistered
      }
    }
    receiver = null
    monitoredAddress = null
  }

  private fun extractDevice(intent: Intent): BluetoothDevice? {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE, BluetoothDevice::class.java)
    } else {
      @Suppress("DEPRECATION")
      intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)
    }
  }

  private fun safeName(device: BluetoothDevice): String? = try {
    device.name
  } catch (e: SecurityException) {
    null
  }

  // BluetoothDevice#isConnected() isn't part of the public SDK on any
  // level we compile against, but it's a hidden method present on every AOSP
  // and OEM build we've seen (reflection, not a public API call). It's only
  // used for a best-effort "already connected" snapshot when monitoring
  // starts; if reflection ever fails on some OEM build we just report "not
  // connected" until the next ACL broadcast rather than crash.
  private fun isCurrentlyConnected(address: String): Boolean {
    val device = try {
      adapter?.getRemoteDevice(address)
    } catch (e: Exception) {
      null
    } ?: return false
    return try {
      val method = BluetoothDevice::class.java.getMethod("isConnected")
      method.invoke(device) as? Boolean ?: false
    } catch (e: Exception) {
      false
    }
  }
}
