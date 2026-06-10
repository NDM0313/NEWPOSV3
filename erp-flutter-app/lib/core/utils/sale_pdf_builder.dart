import 'dart:io';

import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

import '../../data/models/sale.dart';
import 'formatters.dart';

Future<File> buildSalePdfFile(SaleDetail sale) async {
  final doc = pw.Document();
  doc.addPage(
    pw.Page(
      pageFormat: PdfPageFormat.a4,
      build: (context) {
        return pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Text('DIN Collection ERP', style: pw.TextStyle(fontSize: 18, fontWeight: pw.FontWeight.bold)),
            pw.SizedBox(height: 8),
            pw.Text('Invoice: ${sale.documentNo}'),
            pw.Text('Customer: ${sale.customerName}'),
            pw.Text('Date: ${sale.date}'),
            pw.Text('Status: ${sale.status}'),
            pw.SizedBox(height: 12),
            pw.Text('Total: ${formatMoney(sale.total)}'),
            pw.Text('Paid: ${formatMoney(sale.paid)}'),
            pw.Text('Due: ${formatMoney(sale.due)}'),
            if (sale.items.isNotEmpty) ...[
              pw.SizedBox(height: 16),
              pw.Text('Items', style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
              pw.SizedBox(height: 6),
              ...sale.items.map(
                (item) => pw.Text(
                  '${item.productName} · Qty ${item.quantity} · ${formatMoney(item.total)}',
                ),
              ),
            ],
          ],
        );
      },
    ),
  );

  final dir = await getTemporaryDirectory();
  final safeNo = sale.documentNo.replaceAll(RegExp(r'[^\w\-]+'), '_');
  final file = File('${dir.path}/invoice_$safeNo.pdf');
  await file.writeAsBytes(await doc.save());
  return file;
}
