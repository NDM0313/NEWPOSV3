import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/app_colors.dart';
import '../../../core/session/session_scope.dart';
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

    final repo = ref.read(purchasesWriteRepositoryProvider);
    final result = await repo.createDraftPurchase(
      companyId: scope.companyId,
      branchId: scope.branchId!,
      createdBy: scope.authUserId,
      supplierName: _supplierController.text,
      items: _lines
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
          .toList(),
    );

    if (!mounted) return;

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
