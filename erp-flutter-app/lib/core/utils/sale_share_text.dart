import '../../data/models/sale.dart';
import 'formatters.dart';

String buildSaleShareText(SaleDetail sale) {
  final lines = <String>[
    'Invoice: ${sale.documentNo}',
    'Customer: ${sale.customerName}',
    'Date: ${sale.date}',
    'Status: ${sale.status}',
    'Total: ${formatMoney(sale.total)}',
    'Paid: ${formatMoney(sale.paid)}',
    'Due: ${formatMoney(sale.due)}',
  ];

  if (sale.items.isNotEmpty) {
    lines.add('');
    lines.add('Items:');
    for (final item in sale.items) {
      lines.add(
        '• ${item.productName} x${item.quantity} — ${formatMoney(item.total)}',
      );
    }
  }

  lines.add('');
  lines.add('DIN Collection ERP');
  return lines.join('\n');
}
