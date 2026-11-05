import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/app_colors.dart';
import '../../../core/session/session_scope.dart';
import '../../../core/utils/formatters.dart';
import '../../../data/models/product.dart';
import '../../../data/models/sale.dart';
import '../../../data/repositories/sales_write_repository.dart';
import '../../../core/widgets/app_error_state.dart';
import '../../../core/widgets/app_loading.dart';
import '../../auth/providers/auth_session_provider.dart';
import '../../auth/providers/repository_providers.dart';
import '../../products/providers/products_providers.dart';
import '../providers/sales_providers.dart';

class SaleEditScreen extends ConsumerStatefulWidget {
  const SaleEditScreen({super.key, required this.saleId});

  final String saleId;

  @override
  ConsumerState<SaleEditScreen> createState() => _SaleEditScreenState();
}

class _EditLine {
  _EditLine({
    required this.productId,
    required this.productName,
    required this.sku,
    required this.quantity,
    required this.unitPrice,
  });

  final String productId;
  final String productName;
  final String sku;
  final double quantity;
  final double unitPrice;

  double get total => quantity * unitPrice;
}

class _SaleEditScreenState extends ConsumerState<SaleEditScreen> {
  final _customerController = TextEditingController();
  final List<_EditLine> _lines = [];
  bool _initialized = false;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _customerController.dispose();
    super.dispose();
  }

  void _initFromSale(SaleDetail sale) {
    if (_initialized) return;
    _customerController.text = sale.customerName;
    for (final item in sale.items) {
      if (item.productId.isEmpty) continue;
      _lines.add(
        _EditLine(
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        ),
      );
    }
    _initialized = true;
  }

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
        _lines.add(
          _EditLine(
            productId: picked.id,
            productName: picked.name,
            sku: picked.sku,
            quantity: 1,
            unitPrice: picked.retailPrice,
          ),
        );
        _error = null;
      });
    }
  }

  Future<void> _save() async {
    final scope = SessionScope.from(ref.read(authSessionProvider));
    if (scope == null) {
      setState(() => _error = 'Session missing.');
      return;
    }
    if (_lines.isEmpty) {
      setState(() => _error = 'Add at least one line.');
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });

    final repo = ref.read(salesWriteRepositoryProvider);
    final result = await repo.updateSaleWithItems(
      saleId: widget.saleId,
      userId: scope.authUserId,
      customerName: _customerController.text,
      items: _lines
          .map(
            (l) => DraftSaleLineInput(
              productId: l.productId,
              productName: l.productName,
              sku: l.sku,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              total: l.total,
            ),
          )
          .toList(),
    );

    if (!mounted) return;

    if (!result.success) {
      setState(() {
        _saving = false;
        _error = result.error ?? 'Update failed.';
      });
      return;
    }

    ref.invalidate(saleDetailProvider(widget.saleId));
    ref.invalidate(salesListProvider);
    context.pop();
  }

  @override
  Widget build(BuildContext context) {
    final asyncSale = ref.watch(saleDetailProvider(widget.saleId));

    return asyncSale.when(
      loading: () => const Scaffold(body: AppLoading(message: 'Loading sale…')),
      error: (e, _) => Scaffold(
        body: AppErrorState(
          message: e.toString(),
          onRetry: () => ref.invalidate(saleDetailProvider(widget.saleId)),
        ),
      ),
      data: (sale) {
        if (sale == null || !isSaleStatusFinalizable(sale.status)) {
          return Scaffold(
            appBar: AppBar(title: const Text('Edit sale')),
            body: const AppErrorState(message: 'This sale cannot be edited.'),
          );
        }
        _initFromSale(sale);

        return Scaffold(
          appBar: AppBar(
            title: Text('Edit ${sale.documentNo}'),
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
                      decoration: const InputDecoration(labelText: 'Customer name'),
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
                    ..._lines.asMap().entries.map((entry) {
                      final i = entry.key;
                      final line = entry.value;
                      return Card(
                        color: AppColors.surface,
                        child: ListTile(
                          title: Text(line.productName),
                          subtitle: Text(
                            '${line.sku} · ${formatMoney(line.unitPrice)} × ${line.quantity}',
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
                                    setState(() => _lines[i] = _EditLine(
                                          productId: line.productId,
                                          productName: line.productName,
                                          sku: line.sku,
                                          quantity: line.quantity - 1,
                                          unitPrice: line.unitPrice,
                                        ));
                                  }
                                },
                              ),
                              IconButton(
                                icon: const Icon(Icons.add),
                                onPressed: () {
                                  setState(() => _lines[i] = _EditLine(
                                        productId: line.productId,
                                        productName: line.productName,
                                        sku: line.sku,
                                        quantity: line.quantity + 1,
                                        unitPrice: line.unitPrice,
                                      ));
                                },
                              ),
                            ],
                          ),
                        ),
                      );
                    }),
                    if (_error != null)
                      Text(_error!, style: const TextStyle(color: AppColors.error)),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(16),
                child: ElevatedButton(
                  onPressed: _saving ? null : _save,
                  child: _saving
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Save changes'),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
