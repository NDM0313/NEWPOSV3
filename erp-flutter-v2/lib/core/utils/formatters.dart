import 'package:intl/intl.dart';

final _currencyFormat = NumberFormat.currency(symbol: 'Rs. ', decimalDigits: 0);

String formatMoney(num value) => _currencyFormat.format(value);

String formatMoneyOrDash(num? value, {bool show = true}) {
  if (!show) return '—';
  return formatMoney(value ?? 0);
}

String formatQty(double q) {
  if (q == q.roundToDouble()) return q.toInt().toString();
  return q.toStringAsFixed(2);
}
