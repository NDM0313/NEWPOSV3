package com.dincouture.erp;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.os.Build;
import android.os.IBinder;
import android.os.RemoteException;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;
import java.lang.reflect.Method;
import java.util.Set;
import java.util.UUID;

/**
 * Sunmi built-in printer (woyou AIDL) + classic Bluetooth SPP for ESC/POS.
 */
@CapacitorPlugin(name = "ErpPrinter")
public class ErpPrinterPlugin extends Plugin {

    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private Object woyouService;
    private ServiceConnection sunmiConnection;

    @PluginMethod
    public void getCapabilities(PluginCall call) {
        JSObject ret = new JSObject();
        boolean sunmi = isSunmiDevice();
        ret.put("sunmi", sunmi && bindSunmiIfNeeded());
        ret.put("bluetooth", BluetoothAdapter.getDefaultAdapter() != null);
        ret.put("platform", "android");
        call.resolve(ret);
    }

    @PluginMethod
    public void printRaw(PluginCall call) {
        String dataB64 = call.getString("data");
        if (dataB64 == null) {
            call.reject("Missing data");
            return;
        }
        byte[] bytes = Base64.decode(dataB64, Base64.DEFAULT);
        try {
            if (bindSunmiIfNeeded() && printSunmiRaw(bytes)) {
                JSObject ok = new JSObject();
                ok.put("ok", true);
                call.resolve(ok);
                return;
            }
            call.reject("Sunmi printer not available");
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void listPairedBluetooth(PluginCall call) {
        JSArray devices = new JSArray();
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter != null) {
            Set<BluetoothDevice> paired = adapter.getBondedDevices();
            if (paired != null) {
                for (BluetoothDevice d : paired) {
                    JSObject item = new JSObject();
                    item.put("name", d.getName() != null ? d.getName() : "Unknown");
                    item.put("address", d.getAddress());
                    devices.put(item);
                }
            }
        }
        JSObject ret = new JSObject();
        ret.put("devices", devices);
        call.resolve(ret);
    }

    @PluginMethod
    public void printBluetooth(PluginCall call) {
        String address = call.getString("address");
        String dataB64 = call.getString("data");
        if (address == null || dataB64 == null) {
            call.reject("Missing address or data");
            return;
        }
        byte[] bytes = Base64.decode(dataB64, Base64.DEFAULT);
        BluetoothSocket socket = null;
        try {
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter == null) {
                call.reject("Bluetooth not supported");
                return;
            }
            BluetoothDevice device = adapter.getRemoteDevice(address);
            socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
            socket.connect();
            OutputStream out = socket.getOutputStream();
            out.write(bytes);
            out.flush();
            JSObject ok = new JSObject();
            ok.put("ok", true);
            call.resolve(ok);
        } catch (Exception e) {
            call.reject(e.getMessage());
        } finally {
            if (socket != null) {
                try {
                    socket.close();
                } catch (Exception ignored) {
                }
            }
        }
    }

    private boolean isSunmiDevice() {
        String m = Build.MANUFACTURER != null ? Build.MANUFACTURER.toLowerCase() : "";
        String model = Build.MODEL != null ? Build.MODEL.toLowerCase() : "";
        return m.contains("sunmi") || model.contains("sunmi");
    }

    private boolean bindSunmiIfNeeded() {
        if (woyouService != null) return true;
        Context ctx = getContext();
        if (ctx == null) return false;
        try {
            Intent intent = new Intent();
            intent.setPackage("woyou.aidlservice.jiuiv5");
            intent.setAction("woyou.aidlservice.jiuiv5.IWoyouService");
            sunmiConnection = new ServiceConnection() {
                @Override
                public void onServiceConnected(ComponentName name, IBinder service) {
                    try {
                        Class<?> stub = Class.forName("woyou.aidlservice.jiuiv5.IWoyouService$Stub");
                        Method asInterface = stub.getMethod("asInterface", IBinder.class);
                        woyouService = asInterface.invoke(null, service);
                    } catch (Exception ignored) {
                        woyouService = null;
                    }
                }

                @Override
                public void onServiceDisconnected(ComponentName name) {
                    woyouService = null;
                }
            };
            return ctx.bindService(intent, sunmiConnection, Context.BIND_AUTO_CREATE);
        } catch (Exception e) {
            return false;
        }
    }

    private boolean printSunmiRaw(byte[] bytes) throws RemoteException {
        if (woyouService == null) return false;
        try {
            Method sendRAW = woyouService.getClass().getMethod("sendRAWData", byte[].class, Object.class);
            sendRAW.invoke(woyouService, bytes, null);
            Method lineWrap = woyouService.getClass().getMethod("lineWrap", int.class, Object.class);
            lineWrap.invoke(woyouService, 3, null);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (sunmiConnection != null && getContext() != null) {
            try {
                getContext().unbindService(sunmiConnection);
            } catch (Exception ignored) {
            }
        }
        super.handleOnDestroy();
    }
}
