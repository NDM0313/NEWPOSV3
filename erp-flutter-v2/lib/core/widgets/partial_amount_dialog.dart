import 'package:flutter/material.dart';

import '../utils/formatters.dart';

/// Prompt for a partial payment amount capped at [maxAmount].
Future<double?> showPartialAmountDialog({
  required BuildContext context,
  required String title,
  required double maxAmount,
  String? hint,
}) async {
  final controller = TextEditingController(
    text: maxAmount > 0 ? maxAmount.toStringAsFixed(2) : '',
  );

  final result = await showDialog<double>(
    context: context,
    builder: (ctx) {
      return AlertDialog(
        title: Text(title),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (hint != null) ...[
              Text(hint),
              const SizedBox(height: 8),
            ],
            Text('Maximum: ${formatMoney(maxAmount)}'),
            const SizedBox(height: 8),
            TextField(
              controller: controller,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(
                labelText: 'Amount',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              final parsed = double.tryParse(controller.text.trim());
              if (parsed == null || parsed <= 0) {
                Navigator.pop(ctx);
                return;
              }
              if (parsed > maxAmount + 0.005) {
                Navigator.pop(ctx);
                return;
              }
              Navigator.pop(ctx, parsed);
            },
            child: const Text('Confirm'),
          ),
        ],
      );
    },
  );

  controller.dispose();
  return result;
}
