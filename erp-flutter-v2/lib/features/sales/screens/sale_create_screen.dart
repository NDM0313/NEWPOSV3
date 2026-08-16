import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/app_colors.dart';
import '../../../core/session/session_scope.dart';
import '../../../core/utils/formatters.dart';
import '../../../data/models/product.dart';
import '../../../core/network/network_status_provider.dart';
import '../../../core/sync/sync_providers.dart';
import '../../../data/local/offline_pending_store.dart';
import '../../../data/repositories/sales_write_repository.dart';
import '../../../data/sync/enqueue_or_run.dart';
import '../../auth/providers/auth_session_provider.dart';
import '../../auth/providers/repository_providers.dart';
import '../../products/providers/products_providers.dart';
import '../providers/sales_providers.dart';

class SaleCreateScreen extends ConsumerStatefulWidget {
  const SaleCreateScreen({super.key});

  @override
  ConsumerState<SaleCreateScreen> createState() => _SaleCreateScreenState();
}

class _DraftLine {
  _DraftLine({
    required this.product,
    required this.quantity,
  });

  final Product product;
  final double quantity;

  double get total => quantity * product.retailPrice;
}

class _SaleCreateScreenState extends ConsumerState<SaleCreateScreen> {
  final _customerController = TextEditingController(text: 'Walk-in');
  final List<_DraftLine> _lines = [];
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _customerController.dispose();
    super.dispose();
  }

  double get _total => _lines.fold(0, (sum, l) => sum + l.total);

  Future<void> _pickProduct() async {
    final products = await ref.read(productsListProvider.future);
    if (!mounted) return;
    if (products.isEmpty) {
      setState(() => _error = 'No products available.');
      return;
    }

    final picked = await showModalBottomSheet<Product>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) {
        return DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.6,
          builder: (_, controller) {
            return ListView.builder(
              controller: controller,
              itemCount: products.length,
              itemBuilder: (_, i) {
                final p = products[i];
                return ListTile(
                  title: Text(p.name),
                  subtitle: Text('${p.sku} · ${formatMoney(p.retailPrice)}'),
                  onTap: () => Navigator.pop(ctx, p),
                );
              },
            );
          },
        );
      },
    );

    if (picked != null) {
      setState(() {
        _lines.add(_DraftLine(product: picked, quantity: 1));
        _error = null;
      });
    }
  }

  Future<void> _saveDraft() async {
    final session = ref.read(authSessionProvider);
    final scope = SessionScope.from(session);
    if (scope == null || scope.branchId == null) {
      setState(() => _error = 'Session or branch missing.');
      return;
    }
    if (_lines.isEmpty) {
      setState(() => _error = 'Add at least one product line.');
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });

    final online = ref.read(connectivityProvider).value ?? true;
    final itemPayload = _lines
        .map(
          (l) => {
            'product_id': l.product.id,
            'product_name': l.product.name,
            'sku': l.product.sku,
            'quantity': l.quantity,
            'unit_price': l.product.retailPrice,
            'total': l.total,
          },
        )
        .toList();
    final draftItems = _lines
        .map(
          (l) => DraftSaleLineInput(
            productId: l.product.id,
            productName: l.product.name,
            sku: l.product.sku,
            quantity: l.quantity,
            unitPrice: l.product.retailPrice,
            total: l.total,
          ),
        )
        .toList();

    final repo = ref.read(salesWriteRepositoryProvider);
    final enqueueResult = await enqueueOrRun(
      isOnline: online,
      type: PendingType.draftSale,
      payload: {
        'company_id': scope.companyId,
        'branch_id': scope.branchId!,
        'created_by': scope.authUserId,
        'customer_name': _customerController.text,
        'items': itemPayload,
      },
      companyId: scope.companyId,
      branchId: scope.branchId!,
      onlineTask: () => repo.createDraftSale(
        companyId: scope.companyId,
        branchId: scope.branchId!,
        createdBy: scope.authUserId,
        customerName: _customerController.text,
        items: draftItems,
      ),
    );

    if (!mounted) return;

    switch (enqueueResult) {
      case OfflineQueued():
        ref.invalidate(pendingSyncCountProvider);
        setState(() => _saving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Draft queued offline — sync when online.')),
        );
        context.pop();
        return;
      case OnlineResult(value: final result):
        if (result.error != null || result.saleId == null) {
          setState(() {
            _saving = false;
            _error = result.error ?? 'Failed to save draft.';
          });
          return;
        }
        ref.invalidate(salesListProvider);
        context.go('/sales/${result.saleId}');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('New draft sale'),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => context.pop(),
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                TextField(
                  controller: _customerController,
                  decoration: const InputDecoration(
                    labelText: 'Customer name',
                    hintText: 'Walk-in',
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    const Text(
                      'Line items',
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
                    const Spacer(),
                    TextButton.icon(
                      onPressed: _pickProduct,
                      icon: const Icon(Icons.add),
                      label: const Text('Add product'),
                    ),
                  ],
                ),
                if (_lines.isEmpty)
                  const Padding(
                    padding: EdgeInsets.all(16),
                    child: Text(
                      'No items yet. Tap Add product.',
                      style: TextStyle(color: AppColors.muted),
                    ),
                  ),
                ..._lines.asMap().entries.map((entry) {
                  final i = entry.key;
                  final line = entry.value;
                  return Card(
                    color: AppColors.surface,
                    child: ListTile(
                      title: Text(line.product.name),
                      subtitle: Text(
                        '${line.product.sku} · ${formatMoney(line.product.retailPrice)} × ${line.quantity}',
                      ),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            icon: const Icon(Icons.remove),
                            onPressed: () {
                              if (line.quantity <= 1) {
                                setState(() => _lines.removeAt(i));
                              } else {
                                setState(() => _lines[i] = _DraftLine(
                                      product: line.product,
                                      quantity: line.quantity - 1,
                                    ));
                              }
                            },
                          ),
                          IconButton(
                            icon: const Icon(Icons.add),
                            onPressed: () {
                              setState(() => _lines[i] = _DraftLine(
                                    product: line.product,
                                    quantity: line.quantity + 1,
                                  ));
                            },
                          ),
                        ],
                      ),
                    ),
                  );
                }),
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(_error!, style: const TextStyle(color: AppColors.error)),
                  ),
                const SizedBox(height: 8),
                const Text(
                  'Saves as draft — finalize from sale detail after sync.',
                  style: TextStyle(color: AppColors.muted, fontSize: 12),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
          SafeArea(
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.surface,
                border: Border(top: BorderSide(color: AppColors.border)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      'Total ${formatMoney(_total)}',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
                    ),
                  ),
                  ElevatedButton(
                    onPressed: _saving ? null : _saveDraft,
                    child: _saving
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Save draft'),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
