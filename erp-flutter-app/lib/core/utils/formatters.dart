import 'package:intl/intl.dart';

final _currencyFormat = NumberFormat.currency(symbol: 'Rs. ', decimalDigits: 0);

String formatMoney(num value) => _currencyFormat.format(value);

String formatMoneyOrDash(num? value, {bool show = true}) {
  if (!show) return '—';
  return formatMoney(value ?? 0);
}
