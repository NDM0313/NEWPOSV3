import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/providers/auth_session_provider.dart';
import '../../auth/providers/repository_providers.dart';

Future<bool?> showStockAdjustmentSheet({
  required BuildContext context,
  required String productId,
  required String productName,
  required double currentStock,
}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    builder: (ctx) => _StockAdjustmentSheet(
      productId: productId,
      productName: productName,
      currentStock: currentStock,
    ),
  );
}

class _StockAdjustmentSheet extends ConsumerStatefulWidget {
  const _StockAdjustmentSheet({
    required this.productId,
    required this.productName,
    required this.currentStock,
  });

  final String productId;
  final String productName;
  final double currentStock;

  @override
  ConsumerState<_StockAdjustmentSheet> createState() =>
      _StockAdjustmentSheetState();
}

class _StockAdjustmentSheetState extends ConsumerState<_StockAdjustmentSheet> {
  final _deltaController = TextEditingController();
  final _reasonController = TextEditingController();
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _deltaController.dispose();
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final delta = double.tryParse(_deltaController.text.trim());
    if (delta == null || delta == 0) {
      setState(() => _error = 'Enter a non-zero quantity change (+/-).');
      return;
    }

    final session = ref.read(authSessionProvider);
    final companyId = session.companyId;
    final branch = session.selectedBranch;
    final profile = session.profile;
    if (companyId == null || branch == null) {
      setState(() => _error = 'Session incomplete.');
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });

    final repo = ref.read(inventoryRepositoryProvider);
    final result = await repo.adjustStock(
      companyId: companyId,
      branchId: branch.id,
      productId: widget.productId,
      quantityDelta: delta,
      reason: _reasonController.text,
      userId: profile?.id,
    );

    if (!mounted) return;
    if (result.success) {
      Navigator.of(context).pop(true);
    } else {
      setState(() {
        _saving = false;
        _error = result.error;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 24,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Adjust stock',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 4),
          Text(widget.productName),
          Text('Current: ${widget.currentStock}'),
          const SizedBox(height: 16),
          TextField(
            controller: _deltaController,
            keyboardType: const TextInputType.numberWithOptions(
              signed: true,
              decimal: true,
            ),
            decoration: const InputDecoration(
              labelText: 'Quantity change (+/-)',
              hintText: 'e.g. -2 or 5',
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _reasonController,
            decoration: const InputDecoration(labelText: 'Reason'),
            maxLines: 2,
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ],
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Save adjustment'),
          ),
        ],
      ),
    );
  }
}
