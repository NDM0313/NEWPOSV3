import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/app_colors.dart';
import '../../../core/session/session_scope.dart';
import '../../../data/models/product.dart';
import '../../../core/widgets/module_scaffold.dart';
import '../../auth/providers/auth_session_provider.dart';
import '../../auth/providers/repository_providers.dart';
import '../providers/products_providers.dart';

class ProductEditScreen extends ConsumerStatefulWidget {
  const ProductEditScreen({super.key, required this.productId});

  final String productId;

  @override
  ConsumerState<ProductEditScreen> createState() => _ProductEditScreenState();
}

class _ProductEditScreenState extends ConsumerState<ProductEditScreen> {
  final _nameController = TextEditingController();
  final _skuController = TextEditingController();
  final _costController = TextEditingController();
  final _priceController = TextEditingController();
  bool _active = true;
  bool _saving = false;
  bool _loaded = false;
  String? _error;

  @override
  void dispose() {
    _nameController.dispose();
    _skuController.dispose();
    _costController.dispose();
    _priceController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final scope = SessionScope.from(ref.read(authSessionProvider));
    if (scope == null) {
      setState(() => _error = 'Session missing.');
      return;
    }

    final cost = double.tryParse(_costController.text.trim()) ?? 0;
    final price = double.tryParse(_priceController.text.trim()) ?? 0;

    setState(() {
      _saving = true;
      _error = null;
    });

    final repo = ref.read(productsWriteRepositoryProvider);
    final result = await repo.updateProduct(
      companyId: scope.companyId,
      productId: widget.productId,
      name: _nameController.text,
      sku: _skuController.text,
      costPrice: cost,
      retailPrice: price,
      active: _active,
    );

    if (!mounted) return;

    if (!result.success) {
      setState(() {
        _saving = false;
        _error = result.error ?? 'Update failed.';
      });
      return;
    }

    ref.invalidate(productsListProvider);
    ref.invalidate(productDetailProvider(widget.productId));
    context.pop();
  }

  @override
  Widget build(BuildContext context) {
    final asyncProduct = ref.watch(productDetailProvider(widget.productId));

    return ModuleScaffold(
      title: 'Edit product',
      body: asyncProduct.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text(e.toString())),
        data: (product) {
          if (product == null) {
            return const Center(child: Text('Product not found.'));
          }
          if (!_loaded) {
            _nameController.text = product.name;
            _skuController.text = product.sku;
            _costController.text = product.costPrice.toString();
            _priceController.text = product.retailPrice.toString();
            _active = product.status == ProductStatus.active;
            _loaded = true;
          }

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Text(_error!, style: const TextStyle(color: AppColors.error)),
                ),
              TextField(
                controller: _nameController,
                decoration: const InputDecoration(labelText: 'Name', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _skuController,
                decoration: const InputDecoration(labelText: 'SKU', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _costController,
                decoration: const InputDecoration(labelText: 'Cost', border: OutlineInputBorder()),
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _priceController,
                decoration: const InputDecoration(labelText: 'Retail price', border: OutlineInputBorder()),
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
              ),
              const SizedBox(height: 8),
              SwitchListTile(
                title: const Text('Active'),
                value: _active,
                onChanged: (v) => setState(() => _active = v),
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _saving ? null : _save,
                child: _saving
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Save changes'),
              ),
            ],
          );
        },
      ),
    );
  }
}
