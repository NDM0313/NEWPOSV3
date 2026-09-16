import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/app_colors.dart';
import '../../../core/permissions/sale_actions.dart';
import '../../../core/session/session_scope.dart';
import '../../../core/utils/formatters.dart';
import '../../auth/providers/auth_session_provider.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_state.dart';
import '../../../core/widgets/app_loading.dart';
import '../../../core/widgets/module_scaffold.dart';
import '../../../data/models/sale.dart';
import '../providers/sales_providers.dart';

class SalesListScreen extends ConsumerStatefulWidget {
  const SalesListScreen({super.key});

  @override
  ConsumerState<SalesListScreen> createState() => _SalesListScreenState();
}

class _SalesListScreenState extends ConsumerState<SalesListScreen> {
  final _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<SaleListItem> _filter(List<SaleListItem> sales) {
    final q = _searchQuery.trim().toLowerCase();
    if (q.isEmpty) return sales;
    return sales.where((s) {
      return s.documentNo.toLowerCase().contains(q) ||
          s.customerName.toLowerCase().contains(q) ||
          s.status.toLowerCase().contains(q);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(authSessionProvider);
    final scope = SessionScope.from(session);
    final canCreate = scope != null && canCreateSale(scope.permissions);
    final asyncSales = ref.watch(salesListProvider);

    return ModuleScaffold(
      title: 'Sales',
      actions: canCreate
          ? [
              IconButton(
                icon: const Icon(Icons.add),
                tooltip: 'New draft sale',
                onPressed: () => context.push('/sales/new'),
              ),
            ]
          : null,
      body: Column(
        children: [
          ModuleSearchField(
            controller: _searchController,
            hint: 'Search invoice, customer, status…',
            onChanged: (v) => setState(() => _searchQuery = v),
          ),
          Expanded(
            child: asyncSales.when(
              loading: () => const AppLoading(message: 'Loading sales…'),
              error: (e, _) => AppErrorState(
                message: e.toString().replaceFirst('Exception: ', ''),
                onRetry: () => ref.invalidate(salesListProvider),
              ),
              data: (sales) {
                final filtered = _filter(sales);
                if (filtered.isEmpty) {
                  return const AppEmptyState(
                    title: 'No sales found',
                    subtitle: 'Try another search or check your access.',
                  );
                }
                return ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: filtered.length,
                  separatorBuilder: (context, index) =>
                      const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final sale = filtered[index];
                    return _SaleListTile(
                      sale: sale,
                      onTap: () => context.push('/sales/${sale.id}'),
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

class _SaleListTile extends StatelessWidget {
  const _SaleListTile({required this.sale, required this.onTap});

  final SaleListItem sale;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
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
                      sale.documentNo,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      sale.customerName,
                      style: const TextStyle(color: AppColors.muted, fontSize: 12),
                    ),
                    Text(
                      '${sale.date} · ${sale.status}${sale.isStudio ? ' · Studio' : ''}',
                      style: const TextStyle(color: AppColors.muted, fontSize: 12),
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    formatMoney(sale.total),
                    style: const TextStyle(
                      color: AppColors.primary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (sale.due > 0)
                    Text(
                      'Due ${formatMoney(sale.due)}',
                      style: const TextStyle(color: AppColors.warning, fontSize: 11),
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
