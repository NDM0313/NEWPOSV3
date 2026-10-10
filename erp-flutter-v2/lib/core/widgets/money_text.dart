import 'package:flutter/material.dart';

import '../../core/utils/formatters.dart';

/// Compact currency display for data-dense ERP tables and summary bars.
class MoneyText extends StatelessWidget {
  const MoneyText(
    this.amount, {
    super.key,
    this.style,
    this.color,
    this.bold = false,
  });

  final double amount;
  final TextStyle? style;
  final Color? color;
  final bool bold;

  @override
  Widget build(BuildContext context) {
    final base = style ?? Theme.of(context).textTheme.bodyMedium;
    return Text(
      formatMoney(amount),
      style: base?.copyWith(
        color: color,
        fontWeight: bold ? FontWeight.w700 : base.fontWeight,
        fontFeatures: const [FontFeature.tabularFigures()],
      ),
    );
  }
}
