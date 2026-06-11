package com.dincouture.erp.erp_flutter_app

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothSocket
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.content.pm.PackageManager
import android.os.Build
import android.os.IBinder
import android.os.RemoteException
import android.util.Base64
import androidx.core.content.ContextCompat
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import java.io.OutputStream
import java.lang.reflect.Method
import java.util.UUID

/**
 * Sunmi built-in printer (woyou AIDL) + classic Bluetooth SPP for ESC/POS.
 * Port of Capacitor ErpPrinterPlugin.java.
 */
class ErpPrinterChannel(private val context: Context) : MethodChannel.MethodCallHandler {

    private var woyouService: Any? = null
    private var sunmiConnection: ServiceConnection? = null

    companion object {
        private const val CHANNEL = "com.dincouture.erp/erp_printer"
        private val SPP_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")

        fun register(engine: FlutterEngine, context: Context) {
            MethodChannel(engine.dartExecutor.binaryMessenger, CHANNEL)
                .setMethodCallHandler(ErpPrinterChannel(context))
        }
    }

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "getCapabilities" -> getCapabilities(result)
            "printRaw" -> {
                val dataB64 = call.argument<String>("data")
                if (dataB64 == null) {
                    result.error("MISSING", "Missing data", null)
                    return
                }
                printRaw(dataB64, result)
            }
            "listPairedBluetooth" -> listPairedBluetooth(result)
            "printBluetooth" -> {
                val address = call.argument<String>("address")
                val dataB64 = call.argument<String>("data")
                if (address == null || dataB64 == null) {
                    result.error("MISSING", "Missing address or data", null)
                    return
                }
                printBluetooth(address, dataB64, result)
            }
            else -> result.notImplemented()
        }
    }

    private fun getCapabilities(result: MethodChannel.Result) {
        val sunmi = isSunmiDevice()
        val map = hashMapOf<String, Any>(
            "sunmi" to (sunmi && bindSunmiIfNeeded()),
            "bluetooth" to (BluetoothAdapter.getDefaultAdapter() != null),
            "platform" to "android",
        )
        result.success(map)
    }

    private fun printRaw(dataB64: String, result: MethodChannel.Result) {
        val bytes = Base64.decode(dataB64, Base64.DEFAULT)
        try {
            if (bindSunmiIfNeeded() && printSunmiRaw(bytes)) {
                result.success(mapOf("ok" to true))
                return
            }
            result.error("UNAVAILABLE", "Sunmi printer not available", null)
        } catch (e: Exception) {
            result.error("PRINT", e.message, null)
        }
    }

    private fun listPairedBluetooth(result: MethodChannel.Result) {
        val devices = mutableListOf<Map<String, String>>()
        try {
            if (!hasBluetoothConnectPermission()) {
                result.success(mapOf("devices" to devices))
                return
            }
            val adapter = BluetoothAdapter.getDefaultAdapter() ?: run {
                result.success(mapOf("devices" to devices))
                return
            }
            val paired = adapter.bondedDevices
            if (paired != null) {
                for (d in paired) {
                    try {
                        devices.add(
                            mapOf(
                                "name" to (d.name ?: "Unknown"),
                                "address" to d.address,
                            ),
                        )
                    } catch (_: SecurityException) {
                        devices.add(mapOf("name" to "Unknown", "address" to d.address))
                    }
                }
            }
        } catch (_: SecurityException) {
            // Android 12+ without BLUETOOTH_CONNECT
        }
        result.success(mapOf("devices" to devices))
    }

    private fun printBluetooth(address: String, dataB64: String, result: MethodChannel.Result) {
        val bytes = Base64.decode(dataB64, Base64.DEFAULT)
        var socket: BluetoothSocket? = null
        try {
            val adapter = BluetoothAdapter.getDefaultAdapter()
            if (adapter == null) {
                result.error("BT", "Bluetooth not supported", null)
                return
            }
            val device: BluetoothDevice = adapter.getRemoteDevice(address)
            socket = device.createRfcommSocketToServiceRecord(SPP_UUID)
            socket.connect()
            val out: OutputStream = socket.outputStream
            out.write(bytes)
            out.flush()
            result.success(mapOf("ok" to true))
        } catch (e: Exception) {
            result.error("BT", e.message, null)
        } finally {
            try {
                socket?.close()
            } catch (_: Exception) {
            }
        }
    }

    private fun hasBluetoothConnectPermission(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
        return ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT) ==
            PackageManager.PERMISSION_GRANTED
    }

    private fun isSunmiDevice(): Boolean {
        val m = Build.MANUFACTURER?.lowercase() ?: ""
        val model = Build.MODEL?.lowercase() ?: ""
        return m.contains("sunmi") || model.contains("sunmi")
    }

    private fun bindSunmiIfNeeded(): Boolean {
        if (woyouService != null) return true
        return try {
            val intent = Intent().apply {
                setPackage("woyou.aidlservice.jiuiv5")
                action = "woyou.aidlservice.jiuiv5.IWoyouService"
            }
            val conn = object : ServiceConnection {
                override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
                    try {
                        val stub = Class.forName("woyou.aidlservice.jiuiv5.IWoyouService\$Stub")
                        val asInterface = stub.getMethod("asInterface", IBinder::class.java)
                        woyouService = asInterface.invoke(null, service)
                    } catch (_: Exception) {
                        woyouService = null
                    }
                }

                override fun onServiceDisconnected(name: ComponentName?) {
                    woyouService = null
                }
            }
            sunmiConnection = conn
            context.bindService(intent, conn, Context.BIND_AUTO_CREATE)
        } catch (_: Exception) {
            false
        }
    }

    @Throws(RemoteException::class)
    private fun printSunmiRaw(bytes: ByteArray): Boolean {
        val svc = woyouService ?: return false
        return try {
            val sendRaw: Method = svc.javaClass.getMethod("sendRAWData", ByteArray::class.java, Any::class.java)
            sendRaw.invoke(svc, bytes, null)
            val lineWrap: Method = svc.javaClass.getMethod("lineWrap", Int::class.javaPrimitiveType, Any::class.java)
            lineWrap.invoke(svc, 3, null)
            true
        } catch (_: Exception) {
            false
        }
    }
}
