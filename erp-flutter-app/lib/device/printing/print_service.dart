import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import '../../data/models/mobile_printer_settings.dart';
import 'sunmi_channel.dart';
import 'thermal_encoder.dart';

class PrintResult {
  const PrintResult({required this.ok, this.backend, this.hint});

  final bool ok;
  final String? backend;
  final String? hint;
}

class PrintService {
  PrintService._();

  static Future<String> probePrinterBackend(String? bluetoothAddress) async {
    final caps = await ErpPrinterChannel.getCapabilities();
    if (caps.sunmi) {
      return 'sunmi';
    }
    if (caps.bluetooth && bluetoothAddress != null && bluetoothAddress.isNotEmpty) {
      return 'bluetooth';
    }
    return 'none';
  }

  static Future<PrintResult> printReceiptLines(
    List<String> lines,
    MobilePrinterSettings settings,
  ) async {
    if (settings.mode == MobilePrinterMode.a4) {
      return _printA4(lines);
    }

    final paper = settings.paperSize == MobilePrinterPaperSize.mm58
        ? MobilePrinterPaperSize.mm58
        : MobilePrinterPaperSize.mm80;
    final bytes = ThermalEncoder.encodeEscPosUtf8(lines, paperSize: paper);
    final backend = await probePrinterBackend(settings.bluetoothDeviceAddress);

    if (backend == 'sunmi') {
      final ok = await ErpPrinterChannel.printRaw(bytes);
      if (ok) return const PrintResult(ok: true, backend: 'sunmi');
    }

    final mac = settings.bluetoothDeviceAddress;
    if (backend == 'bluetooth' && mac != null && mac.isNotEmpty) {
      final ok = await ErpPrinterChannel.printBluetooth(mac, bytes);
      if (ok) return const PrintResult(ok: true, backend: 'bluetooth');
    }

    return const PrintResult(
      ok: false,
      backend: 'none',
      hint: 'No thermal printer. Pair Bluetooth in Settings or use Sunmi device.',
    );
  }

  static Future<PrintResult> _printA4(List<String> lines) async {
    try {
      final doc = pw.Document();
      doc.addPage(
        pw.Page(
          pageFormat: PdfPageFormat.roll80,
          build: (ctx) => pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: lines.map((l) => pw.Text(l)).toList(),
          ),
        ),
      );
      final bytes = await doc.save();
      await Printing.layoutPdf(onLayout: (_) async => bytes);
      return const PrintResult(ok: true, backend: 'a4');
    } catch (e) {
      return PrintResult(ok: false, hint: e.toString());
    }
  }
}

class PrintAfterTransaction {
  PrintAfterTransaction._();

  static Future<PrintResult?> maybeAutoPrint({
    required MobilePrinterSettings settings,
    required String title,
    String? transactionNo,
    String? partyName,
    double? amount,
    String? date,
    String? branch,
  }) async {
    if (!settings.autoPrintReceipt) return null;

    final lines = ThermalEncoder.formatPlainReceiptLines(
      title: title,
      transactionNo: transactionNo,
      partyName: partyName,
      amount: amount,
      date: date,
      branch: branch,
    );

    return PrintService.printReceiptLines(lines, settings);
  }
}
