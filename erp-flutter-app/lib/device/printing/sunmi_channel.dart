import 'dart:convert';

import 'package:flutter/services.dart';

typedef PrinterBackend = String;

class PrinterCapabilities {
  const PrinterCapabilities({
    required this.sunmi,
    required this.bluetooth,
    required this.platform,
  });

  final bool sunmi;
  final bool bluetooth;
  final String platform;

  factory PrinterCapabilities.fromMap(Map<dynamic, dynamic> map) {
    return PrinterCapabilities(
      sunmi: map['sunmi'] == true,
      bluetooth: map['bluetooth'] == true,
      platform: map['platform']?.toString() ?? 'unknown',
    );
  }
}

class BluetoothDeviceInfo {
  const BluetoothDeviceInfo({required this.name, required this.address});

  final String name;
  final String address;

  factory BluetoothDeviceInfo.fromMap(Map<dynamic, dynamic> map) {
    return BluetoothDeviceInfo(
      name: map['name']?.toString() ?? 'Unknown',
      address: map['address']?.toString() ?? '',
    );
  }
}

class ErpPrinterChannel {
  ErpPrinterChannel._();

  static const _channel = MethodChannel('com.dincouture.erp/erp_printer');

  static Future<PrinterCapabilities> getCapabilities() async {
    try {
      final raw = await _channel.invokeMethod<Map<dynamic, dynamic>>('getCapabilities');
      return PrinterCapabilities.fromMap(raw ?? {});
    } catch (_) {
      return const PrinterCapabilities(sunmi: false, bluetooth: false, platform: 'unknown');
    }
  }

  static Future<bool> printRaw(Uint8List data) async {
    try {
      await _channel.invokeMethod('printRaw', {
        'data': base64Encode(data),
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  static Future<List<BluetoothDeviceInfo>> listPairedBluetooth() async {
    try {
      final raw = await _channel.invokeMethod<Map<dynamic, dynamic>>('listPairedBluetooth');
      final devices = raw?['devices'];
      if (devices is! List) return [];
      return devices
          .whereType<Map>()
          .map((e) => BluetoothDeviceInfo.fromMap(e))
          .where((d) => d.address.isNotEmpty)
          .toList();
    } catch (_) {
      return [];
    }
  }

  static Future<bool> printBluetooth(String address, Uint8List data) async {
    try {
      await _channel.invokeMethod('printBluetooth', {
        'address': address,
        'data': base64Encode(data),
      });
      return true;
    } catch (_) {
      return false;
    }
  }
}
