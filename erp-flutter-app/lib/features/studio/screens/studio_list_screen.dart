import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_state.dart';
import '../../../core/widgets/app_loading.dart';
import '../../../core/widgets/module_scaffold.dart';
import '../../../core/widgets/read_only_banner.dart';
import '../../../data/repositories/studio_read_repository.dart';
import '../providers/studio_providers.dart';

class StudioListScreen extends ConsumerWidget {
  const StudioListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncSales = ref.watch(studioSalesListProvider);

    return ModuleScaffold(
      title: 'Studio',
      body: Column(
        children: [
          const ReadOnlyBanner(),
          Expanded(
            child: asyncSales.when(
              loading: () => const AppLoading(message: 'Loading studio sales…'),
              error: (e, _) => AppErrorState(
                message: e.toString().replaceFirst('Exception: ', ''),
                onRetry: () => ref.invalidate(studioSalesListProvider),
              ),
              data: (sales) {
                if (sales.isEmpty) {
                  return const AppEmptyState(
                    title: 'No studio sales',
                    subtitle: 'Studio orders will appear here.',
                  );
                }
                return ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: sales.length,
                  separatorBuilder: (context, index) => const SizedBox(height: 8),
                  itemBuilder: (_, i) => _StudioTile(sale: sales[i]),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _StudioTile extends StatelessWidget {
  const _StudioTile({required this.sale});

  final StudioSaleRow sale;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => context.push('/sales/${sale.id}'),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    sale.documentNo,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                ),
                Text(sale.status, style: const TextStyle(color: AppColors.muted, fontSize: 12)),
              ],
            ),
            const SizedBox(height: 4),
            Text(sale.customerName, style: const TextStyle(color: AppColors.muted, fontSize: 13)),
            const SizedBox(height: 6),
            Row(
              children: [
                Text(sale.date, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
                const Spacer(),
                Text(
                  formatMoney(sale.total),
                  style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w600),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
