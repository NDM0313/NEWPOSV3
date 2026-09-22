import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/app_colors.dart';
import '../../../core/session/session_scope.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/module_scaffold.dart';
import '../../../data/models/sale.dart';
import '../../../data/repositories/sales_write_repository.dart';
import '../../auth/providers/auth_session_provider.dart';
import '../../auth/providers/repository_providers.dart';
import '../providers/sales_providers.dart';

class SaleReturnScreen extends ConsumerStatefulWidget {
  const SaleReturnScreen({super.key, required this.saleId});

  final String saleId;

  @override
  ConsumerState<SaleReturnScreen> createState() => _SaleReturnScreenState();
}

class _SaleReturnScreenState extends ConsumerState<SaleReturnScreen> {
  final _reasonController = TextEditingController();
  final Map<String, double> _qtyByItemId = {};
  List<SaleLineItem> _items = [];
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  double get _total {
    double sum = 0;
    for (final item in _items) {
      final q = _qtyByItemId[item.id] ?? 0;
      sum += q * item.unitPrice;
    }
    return sum;
  }

  Future<void> _submit(SaleDetail sale) async {
    final scope = SessionScope.from(ref.read(authSessionProvider));
    if (scope == null || scope.branchId == null) {
      setState(() => _error = 'Session or branch missing.');
      return;
    }

    final items = <SaleReturnLineInput>[];
    for (final item in _items) {
      final q = _qtyByItemId[item.id] ?? 0;
      if (q <= 0) continue;
      items.add(
        SaleReturnLineInput(
          saleItemId: item.id,
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          quantity: q,
          unitPrice: item.unitPrice,
        ),
      );
    }

    if (items.isEmpty) {
      setState(() => _error = 'Set return quantity for at least one line.');
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });

    final repo = ref.read(salesWriteRepositoryProvider);
    final result = await repo.createAndFinalizeSaleReturn(
      companyId: scope.companyId,
      branchId: scope.branchId!,
      saleId: widget.saleId,
      userId: scope.authUserId,
      customerName: sale.customerName,
      items: items,
      reason: _reasonController.text.trim().isEmpty ? null : _reasonController.text.trim(),
    );

    if (!mounted) return;

    if (result.error != null && result.returnId == null) {
      setState(() {
        _saving = false;
        _error = result.error;
      });
      return;
    }

    ref.invalidate(saleDetailProvider(widget.saleId));
    ref.invalidate(salesListProvider);
    context.pop();
    if (result.returnNo != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Return ${result.returnNo} created.')),
      );
    }
  }

  void _bumpQty(SaleLineItem item, double delta) {
    final current = _qtyByItemId[item.id] ?? 0;
    final next = (current + delta).clamp(0, item.quantity);
    setState(() => _qtyByItemId[item.id] = next.toDouble());
  }

  @override
  Widget build(BuildContext context) {
    final asyncSale = ref.watch(saleDetailProvider(widget.saleId));

    return ModuleScaffold(
      title: 'Sale return',
      body: asyncSale.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text(e.toString())),
        data: (sale) {
          if (sale == null) {
            return const Center(child: Text('Sale not found.'));
          }
          if (_items.isEmpty && sale.items.isNotEmpty) {
            _items = sale.items;
            for (final item in sale.items) {
              _qtyByItemId[item.id] = item.quantity;
            }
          }

          return Column(
            children: [
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(_error!, style: const TextStyle(color: AppColors.error)),
                ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                child: TextField(
                  controller: _reasonController,
                  decoration: const InputDecoration(
                    labelText: 'Reason (optional)',
                    border: OutlineInputBorder(),
                  ),
                ),
              ),
              Expanded(
                child: ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _items.length,
                  itemBuilder: (_, i) {
                    final item = _items[i];
                    final qty = _qtyByItemId[item.id] ?? 0;
                    return ListTile(
                      title: Text(item.productName),
                      subtitle: Text(
                        'Max ${item.quantity} · ${formatMoney(item.unitPrice)} each',
                      ),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            icon: const Icon(Icons.remove_circle_outline),
                            onPressed: () => _bumpQty(item, -1),
                          ),
                          Text(qty.toString()),
                          IconButton(
                            icon: const Icon(Icons.add_circle_outline),
                            onPressed: () => _bumpQty(item, 1),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
              Container(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Text(
                      formatMoney(_total),
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    const Spacer(),
                    ElevatedButton(
                      onPressed: _saving ? null : () => _submit(sale),
                      child: _saving
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Text('Create return'),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
