import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/app_colors.dart';
import '../../../core/session/session_scope.dart';
import '../../../core/widgets/module_scaffold.dart';
import '../../auth/providers/auth_session_provider.dart';
import '../../auth/providers/repository_providers.dart';
import '../providers/products_providers.dart';

class ProductCreateScreen extends ConsumerStatefulWidget {
  const ProductCreateScreen({super.key});

  @override
  ConsumerState<ProductCreateScreen> createState() => _ProductCreateScreenState();
}

class _ProductCreateScreenState extends ConsumerState<ProductCreateScreen> {
  final _nameController = TextEditingController();
  final _skuController = TextEditingController();
  final _costController = TextEditingController(text: '0');
  final _priceController = TextEditingController(text: '0');
  bool _saving = false;
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
    final result = await repo.createProduct(
      companyId: scope.companyId,
      name: _nameController.text,
      sku: _skuController.text,
      costPrice: cost,
      retailPrice: price,
    );

    if (!mounted) return;

    if (result.error != null || result.productId == null) {
      setState(() {
        _saving = false;
        _error = result.error ?? 'Create failed.';
      });
      return;
    }

    ref.invalidate(productsListProvider);
    context.pop();
    context.push('/products/${result.productId}');
  }

  @override
  Widget build(BuildContext context) {
    return ModuleScaffold(
      title: 'New product',
      body: ListView(
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
            decoration: const InputDecoration(labelText: 'Cost price', border: OutlineInputBorder()),
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _priceController,
            decoration: const InputDecoration(labelText: 'Retail price', border: OutlineInputBorder()),
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
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
                : const Text('Create product'),
          ),
        ],
      ),
    );
  }
}
