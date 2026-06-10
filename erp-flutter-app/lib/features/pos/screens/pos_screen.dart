import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/app_colors.dart';
import '../../../core/session/session_scope.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/module_scaffold.dart';
import '../../../data/models/product.dart';
import '../../../data/repositories/sales_write_repository.dart';
import '../../auth/providers/auth_session_provider.dart';
import '../../auth/providers/repository_providers.dart';
import '../../products/providers/products_providers.dart';

class PosScreen extends ConsumerStatefulWidget {
  const PosScreen({super.key});

  @override
  ConsumerState<PosScreen> createState() => _PosScreenState();
}

class _CartLine {
  _CartLine({required this.product, required this.quantity});

  final Product product;
  final double quantity;

  double get total => quantity * product.retailPrice;
}

class _PosScreenState extends ConsumerState<PosScreen> {
  final _customerController = TextEditingController(text: 'Walk-in');
  final List<_CartLine> _lines = [];
  bool _saving = false;
  String? _error;
  String? _success;

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
        _error = null;
        final idx = _lines.indexWhere((l) => l.product.id == picked.id);
        if (idx >= 0) {
          _lines[idx] = _CartLine(product: picked, quantity: _lines[idx].quantity + 1);
        } else {
          _lines.add(_CartLine(product: picked, quantity: 1));
        }
      });
    }
  }

  Future<void> _checkout() async {
    if (_lines.isEmpty) {
      setState(() => _error = 'Add at least one product.');
      return;
    }

    final scope = SessionScope.from(ref.read(authSessionProvider));
    if (scope == null || scope.branchId == null) {
      setState(() => _error = 'Session or branch missing.');
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
      _success = null;
    });

    final items = _lines
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
    final result = await repo.createPosSale(
      companyId: scope.companyId,
      branchId: scope.branchId!,
      createdBy: scope.authUserId,
      customerName: _customerController.text,
      items: items,
    );

    if (!mounted) return;

    if (result.error != null && result.saleId == null) {
      setState(() {
        _saving = false;
        _error = result.error;
      });
      return;
    }

    setState(() {
      _saving = false;
      _lines.clear();
      _success = 'POS sale ${result.invoiceNo ?? ''} completed.';
    });

    if (result.saleId != null) {
      context.push('/sales/${result.saleId}');
    }
  }

  @override
  Widget build(BuildContext context) {
    return ModuleScaffold(
      title: 'POS',
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
            child: TextField(
              controller: _customerController,
              decoration: const InputDecoration(
                labelText: 'Customer',
                border: OutlineInputBorder(),
              ),
            ),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(_error!, style: const TextStyle(color: AppColors.error)),
            ),
          if (_success != null)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(_success!, style: const TextStyle(color: AppColors.success)),
            ),
          Expanded(
            child: _lines.isEmpty
                ? const Center(child: Text('Tap + to add products'))
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _lines.length,
                    itemBuilder: (_, i) {
                      final line = _lines[i];
                      return ListTile(
                        title: Text(line.product.name),
                        subtitle: Text('Qty ${line.quantity} · ${formatMoney(line.product.retailPrice)}'),
                        trailing: Text(formatMoney(line.total)),
                      );
                    },
                  ),
          ),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surface,
              border: Border(top: BorderSide(color: AppColors.border)),
            ),
            child: Row(
              children: [
                Text(
                  formatMoney(_total),
                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
                const Spacer(),
                IconButton(
                  onPressed: _saving ? null : _pickProduct,
                  icon: const Icon(Icons.add_circle_outline),
                  tooltip: 'Add product',
                ),
                const SizedBox(width: 8),
                ElevatedButton(
                  onPressed: _saving ? null : _checkout,
                  child: _saving
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Checkout'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
