import 'dart:convert';
import 'dart:typed_data';

import '../../data/models/mobile_printer_settings.dart';

class ThermalEncoder {
  static Uint8List encodeEscPosUtf8(
    List<String> lines, {
    MobilePrinterPaperSize paperSize = MobilePrinterPaperSize.mm80,
  }) {
    // paperSize reserved for future column width tuning
    final parts = <int>[0x1b, 0x40, 0x1b, 0x74, 0x10];
    for (final line in lines) {
      parts.addAll(utf8.encode('$line\n'));
    }
    parts.addAll([0x0a, 0x0a, 0x1d, 0x56, 0x41, 0x00]);
    return Uint8List.fromList(parts);
  }

  static List<String> formatPlainReceiptLines({
    required String title,
    String? transactionNo,
    String? partyName,
    double? amount,
    String? date,
    String? branch,
  }) {
    final lines = <String>[title, ''];
    if (transactionNo != null && transactionNo.isNotEmpty) {
      lines.add('No: $transactionNo');
    }
    if (date != null && date.isNotEmpty) {
      lines.add('Date: ${DateTime.tryParse(date)?.toLocal() ?? date}');
    }
    if (branch != null && branch.isNotEmpty) {
      lines.add('Branch: $branch');
    }
    if (partyName != null && partyName.isNotEmpty) {
      lines.add('Party: $partyName');
    }
    if (amount != null) {
      lines.add('');
      lines.add('Amount: Rs. ${amount.toStringAsFixed(0)}');
    }
    lines.addAll(['', 'Thank you.']);
    return lines;
  }
}
