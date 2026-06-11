enum MobilePrinterMode { thermal, a4 }

enum MobilePrinterPaperSize { mm58, mm80 }

class MobilePrinterSettings {
  const MobilePrinterSettings({
    required this.mode,
    required this.paperSize,
    required this.autoPrintReceipt,
    this.bluetoothDeviceAddress,
  });

  final MobilePrinterMode mode;
  final MobilePrinterPaperSize paperSize;
  final bool autoPrintReceipt;
  final String? bluetoothDeviceAddress;

  static const defaults = MobilePrinterSettings(
    mode: MobilePrinterMode.a4,
    paperSize: MobilePrinterPaperSize.mm80,
    autoPrintReceipt: false,
    bluetoothDeviceAddress: null,
  );

  Map<String, dynamic> toJson() => {
        'mode': mode == MobilePrinterMode.thermal ? 'thermal' : 'a4',
        'paperSize': paperSize == MobilePrinterPaperSize.mm58 ? '58mm' : '80mm',
        'autoPrintReceipt': autoPrintReceipt,
        'bluetoothDeviceAddress': bluetoothDeviceAddress,
      };

  factory MobilePrinterSettings.fromJson(Map<String, dynamic> json) {
    return MobilePrinterSettings(
      mode: json['mode'] == 'thermal' ? MobilePrinterMode.thermal : MobilePrinterMode.a4,
      paperSize: json['paperSize'] == '58mm'
          ? MobilePrinterPaperSize.mm58
          : MobilePrinterPaperSize.mm80,
      autoPrintReceipt: json['autoPrintReceipt'] == true,
      bluetoothDeviceAddress: json['bluetoothDeviceAddress'] as String?,
    );
  }

  MobilePrinterSettings copyWith({
    MobilePrinterMode? mode,
    MobilePrinterPaperSize? paperSize,
    bool? autoPrintReceipt,
    String? bluetoothDeviceAddress,
    bool clearBluetooth = false,
  }) {
    return MobilePrinterSettings(
      mode: mode ?? this.mode,
      paperSize: paperSize ?? this.paperSize,
      autoPrintReceipt: autoPrintReceipt ?? this.autoPrintReceipt,
      bluetoothDeviceAddress:
          clearBluetooth ? null : (bluetoothDeviceAddress ?? this.bluetoothDeviceAddress),
    );
  }
}
