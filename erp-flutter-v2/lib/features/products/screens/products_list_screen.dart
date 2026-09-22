import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/app_colors.dart';
import '../../../core/permissions/product_actions.dart';
import '../../../core/session/session_scope.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_state.dart';
import '../../../core/widgets/app_loading.dart';
import '../../../core/widgets/module_scaffold.dart';
import '../../../data/models/product.dart';
import '../../auth/providers/auth_session_provider.dart';
import '../providers/products_providers.dart';

class ProductsListScreen extends ConsumerStatefulWidget {
  const ProductsListScreen({super.key});

  @override
  ConsumerState<ProductsListScreen> createState() => _ProductsListScreenState();
}

class _ProductsListScreenState extends ConsumerState<ProductsListScreen> {
  final _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<Product> _filterProducts(List<Product> products) {
    final q = _searchQuery.trim().toLowerCase();
    if (q.isEmpty) return products;
    return products.where((p) {
      return p.name.toLowerCase().contains(q) ||
          p.sku.toLowerCase().contains(q) ||
          (p.barcode?.toLowerCase().contains(q) ?? false);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(authSessionProvider);
    final scope = SessionScope.from(session);
    final asyncProducts = ref.watch(productsListProvider);
    final showStock = scope != null && productStockVisible(scope);
    final showCost = scope != null && productCostVisible(scope);

    final canCreate = scope != null && canCreateProduct(scope.permissions);

    return ModuleScaffold(
      title: 'Products',
      actions: canCreate
          ? [
              IconButton(
                icon: const Icon(Icons.add),
                tooltip: 'New product',
                onPressed: () => context.push('/products/new'),
              ),
            ]
          : null,
      body: Column(
        children: [
          ModuleSearchField(
            controller: _searchController,
            hint: 'Search name, SKU, barcode…',
            onChanged: (v) => setState(() => _searchQuery = v),
          ),
          Expanded(
            child: asyncProducts.when(
              loading: () => const AppLoading(message: 'Loading products…'),
              error: (e, _) => AppErrorState(
                message: e.toString().replaceFirst('Exception: ', ''),
                onRetry: () => ref.invalidate(productsListProvider),
              ),
              data: (products) {
                final filtered = _filterProducts(products);
                if (filtered.isEmpty) {
                  return const AppEmptyState(
                    title: 'No products found',
                    subtitle: 'Try another search or check branch access.',
                  );
                }
                return ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: filtered.length,
                  separatorBuilder: (context, index) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final product = filtered[index];
                    return _ProductListTile(
                      product: product,
                      showStock: showStock,
                      showCost: showCost,
                      onTap: () => context.push('/products/${product.id}'),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _ProductListTile extends StatelessWidget {
  const _ProductListTile({
    required this.product,
    required this.showStock,
    required this.showCost,
    required this.onTap,
  });

  final Product product;
  final bool showStock;
  final bool showCost;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final subtitleParts = <String>[
      product.sku,
      product.category,
    ];
    if (showStock && !product.hasVariations) {
      subtitleParts.add('Stock: ${product.stock} ${product.unit}');
    }
    if (product.hasVariations) {
      subtitleParts.add('Has variations');
    }

    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.border),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      product.name,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      subtitleParts.join(' · '),
                      style: const TextStyle(color: AppColors.muted, fontSize: 12),
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    formatMoney(product.retailPrice),
                    style: const TextStyle(
                      color: AppColors.primary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (showCost)
                    Text(
                      'Cost ${formatMoney(product.costPrice)}',
                      style: const TextStyle(color: AppColors.muted, fontSize: 11),
                    ),
                ],
              ),
              const Icon(Icons.chevron_right, color: AppColors.muted),
            ],
          ),
        ),
      ),
    );
  }
}
