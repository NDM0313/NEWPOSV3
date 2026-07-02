import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/app_colors.dart';
import '../../../core/network/network_status_provider.dart';
import '../../../core/session/session_scope.dart';
import '../../../core/sync/sync_providers.dart';
import '../../../data/local/offline_pending_store.dart';
import '../../../data/sync/enqueue_or_run.dart';
import '../../../core/utils/formatters.dart';
import '../../../data/models/product.dart';
import '../../../data/repositories/purchases_write_repository.dart';
import '../../auth/providers/auth_session_provider.dart';
import '../../auth/providers/repository_providers.dart';
import '../../products/providers/products_providers.dart';
import '../providers/purchases_providers.dart';

class PurchaseCreateScreen extends ConsumerStatefulWidget {
  const PurchaseCreateScreen({super.key});

  @override
  ConsumerState<PurchaseCreateScreen> createState() =>
      _PurchaseCreateScreenState();
}

class _DraftLine {
  _DraftLine({required this.product, required this.quantity});

  final Product product;
  final double quantity;

  double get total => quantity * product.costPrice > 0
      ? quantity * product.costPrice
      : quantity * product.retailPrice;
}

class _PurchaseCreateScreenState extends ConsumerState<PurchaseCreateScreen> {
  final _supplierController = TextEditingController(text: 'Supplier');
  final List<_DraftLine> _lines = [];
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _supplierController.dispose();
    super.dispose();
  }

  double _unitCost(Product p) =>
      p.costPrice > 0 ? p.costPrice : p.retailPrice;

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
                  subtitle: Text('${p.sku} · ${formatMoney(_unitCost(p))}'),
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
    final scope = SessionScope.from(ref.read(authSessionProvider));
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
    final supplier = _supplierController.text;
    final itemPayload = _lines
        .map(
          (l) => {
            'product_id': l.product.id,
            'product_name': l.product.name,
            'sku': l.product.sku,
            'quantity': l.quantity,
            'unit_price': _unitCost(l.product),
            'total': l.total,
          },
        )
        .toList();
    final draftItems = _lines
        .map(
          (l) => DraftPurchaseLineInput(
            productId: l.product.id,
            productName: l.product.name,
            sku: l.product.sku,
            quantity: l.quantity,
            unitPrice: _unitCost(l.product),
            total: l.total,
          ),
        )
        .toList();

    final repo = ref.read(purchasesWriteRepositoryProvider);
    final enqueueResult = await enqueueOrRun(
      isOnline: online,
      type: PendingType.draftPurchase,
      payload: {
        'company_id': scope.companyId,
        'branch_id': scope.branchId!,
        'created_by': scope.authUserId,
        'supplier_name': supplier,
        'items': itemPayload,
      },
      companyId: scope.companyId,
      branchId: scope.branchId!,
      onlineTask: () => repo.createDraftPurchase(
        companyId: scope.companyId,
        branchId: scope.branchId!,
        createdBy: scope.authUserId,
        supplierName: supplier,
        items: draftItems,
      ),
    );

    if (!mounted) return;

    switch (enqueueResult) {
      case OfflineQueued():
        ref.invalidate(pendingSyncCountProvider);
        setState(() => _saving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Purchase queued offline — sync when online.')),
        );
        context.pop();
        return;
      case OnlineResult(value: final result):
        if (result.error != null || result.purchaseId == null) {
          setState(() {
            _saving = false;
            _error = result.error ?? 'Failed to save draft.';
          });
          return;
        }
        ref.invalidate(purchasesListProvider);
        context.go('/purchases/${result.purchaseId}');
    }
  }

  @override
  Widget build(BuildContext context) {
    final total = _lines.fold<double>(0, (s, l) => s + l.total);

    return Scaffold(
      appBar: AppBar(
        title: const Text('New draft purchase'),
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
                  controller: _supplierController,
                  decoration: const InputDecoration(labelText: 'Supplier name'),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    const Text('Line items', style: TextStyle(fontWeight: FontWeight.w600)),
                    const Spacer(),
                    TextButton.icon(
                      onPressed: _pickProduct,
                      icon: const Icon(Icons.add),
                      label: const Text('Add product'),
                    ),
                  ],
                ),
                ..._lines.map((line) => Card(
                      color: AppColors.surface,
                      child: ListTile(
                        title: Text(line.product.name),
                        subtitle: Text(
                          '${line.product.sku} · ${formatMoney(_unitCost(line.product))} × ${line.quantity}',
                        ),
                      ),
                    )),
                if (_error != null)
                  Text(_error!, style: const TextStyle(color: AppColors.error)),
                const SizedBox(height: 8),
                const Text(
                  'Draft only — finalize posts accounting in a later step.',
                  style: TextStyle(color: AppColors.muted, fontSize: 12),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              border: Border(top: BorderSide(color: AppColors.border)),
            ),
            child: Row(
              children: [
                Text('Total ${formatMoney(total)}', style: const TextStyle(fontWeight: FontWeight.bold)),
                const Spacer(),
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
        ],
      ),
    );
  }
}
