import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme/app_colors.dart';
import '../../../core/session/session_scope.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_state.dart';
import '../../../core/widgets/app_loading.dart';
import '../../../core/widgets/module_scaffold.dart';
import '../../../data/models/product.dart';
import '../../auth/providers/auth_session_provider.dart';
import '../providers/products_providers.dart';

class ProductDetailScreen extends ConsumerWidget {
  const ProductDetailScreen({super.key, required this.productId});

  final String productId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(authSessionProvider);
    final scope = SessionScope.from(session);
    final asyncProduct = ref.watch(productDetailProvider(productId));
    final showStock = scope != null && productStockVisible(scope);
    final showCost = scope != null && productCostVisible(scope);

    return ModuleScaffold(
      title: 'Product',
      body: asyncProduct.when(
        loading: () => const AppLoading(message: 'Loading product…'),
        error: (e, _) => AppErrorState(
          message: e.toString().replaceFirst('Exception: ', ''),
          onRetry: () => ref.invalidate(productDetailProvider(productId)),
        ),
        data: (product) {
          if (product == null) {
            return const AppEmptyState(
              title: 'Product not found',
              subtitle: 'It may have been removed or you lack access.',
            );
          }

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(
                product.name,
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 16),
              _DetailSection(
                children: [
                  _DetailRow(label: 'SKU', value: product.sku),
                  if (product.barcode != null && product.barcode!.isNotEmpty)
                    _DetailRow(label: 'Barcode', value: product.barcode!),
                  _DetailRow(label: 'Category', value: product.category),
                  _DetailRow(label: 'Unit', value: product.unit),
                  _DetailRow(
                    label: 'Status',
                    value: product.status == ProductStatus.active
                        ? 'Active'
                        : 'Inactive',
                  ),
                  if (product.hasVariations)
                    const _DetailRow(label: 'Variations', value: 'Yes'),
                ],
              ),
              const SizedBox(height: 12),
              _DetailSection(
                children: [
                  _DetailRow(
                    label: 'Retail price',
                    value: formatMoney(product.retailPrice),
                  ),
                  if (product.wholesalePrice != null)
                    _DetailRow(
                      label: 'Wholesale',
                      value: formatMoney(product.wholesalePrice!),
                    ),
                  if (showCost)
                    _DetailRow(
                      label: 'Cost price',
                      value: formatMoney(product.costPrice),
                    ),
                  if (showStock && !product.hasVariations) ...[
                    _DetailRow(
                      label: 'Stock',
                      value: '${product.stock} ${product.unit}',
                    ),
                    _DetailRow(
                      label: 'Min stock',
                      value: '${product.minStock} ${product.unit}',
                    ),
                  ],
                ],
              ),
              if (product.description != null &&
                  product.description!.trim().isNotEmpty) ...[
                const SizedBox(height: 12),
                _DetailSection(
                  children: [
                    _DetailRow(label: 'Description', value: product.description!),
                  ],
                ),
              ],
              const SizedBox(height: 24),
              const Text(
                'Read-only view — editing arrives in a later phase.',
                style: TextStyle(color: AppColors.muted, fontSize: 12),
                textAlign: TextAlign.center,
              ),
            ],
          );
        },
      ),
    );
  }
}

class _DetailSection extends StatelessWidget {
  const _DetailSection({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(children: children),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(label, style: const TextStyle(color: AppColors.muted)),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
