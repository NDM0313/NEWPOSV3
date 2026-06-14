import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/app_colors.dart';
import '../../../core/permissions/purchase_actions.dart';
import '../../../core/session/session_scope.dart';
import '../../../core/utils/formatters.dart';
import '../../auth/providers/auth_session_provider.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_state.dart';
import '../../../core/widgets/app_loading.dart';
import '../../../core/widgets/module_scaffold.dart';
import '../../../data/models/purchase.dart';
import '../providers/purchases_providers.dart';

class PurchasesListScreen extends ConsumerStatefulWidget {
  const PurchasesListScreen({super.key});

  @override
  ConsumerState<PurchasesListScreen> createState() =>
      _PurchasesListScreenState();
}

class _PurchasesListScreenState extends ConsumerState<PurchasesListScreen> {
  final _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<PurchaseListItem> _filter(List<PurchaseListItem> purchases) {
    final q = _searchQuery.trim().toLowerCase();
    if (q.isEmpty) return purchases;
    return purchases.where((p) {
      return p.documentNo.toLowerCase().contains(q) ||
          p.supplierName.toLowerCase().contains(q) ||
          p.status.toLowerCase().contains(q);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(authSessionProvider);
    final scope = SessionScope.from(session);
    final canCreate = scope != null && canCreatePurchase(scope.permissions);
    final asyncPurchases = ref.watch(purchasesListProvider);

    return ModuleScaffold(
      title: 'Purchases',
      actions: canCreate
          ? [
              IconButton(
                icon: const Icon(Icons.add),
                tooltip: 'New draft purchase',
                onPressed: () => context.push('/purchases/new'),
              ),
            ]
          : null,
      body: Column(
        children: [
          ModuleSearchField(
            controller: _searchController,
            hint: 'Search PO, supplier, status…',
            onChanged: (v) => setState(() => _searchQuery = v),
          ),
          Expanded(
            child: asyncPurchases.when(
              loading: () => const AppLoading(message: 'Loading purchases…'),
              error: (e, _) => AppErrorState(
                message: e.toString().replaceFirst('Exception: ', ''),
                onRetry: () => ref.invalidate(purchasesListProvider),
              ),
              data: (purchases) {
                final filtered = _filter(purchases);
                if (filtered.isEmpty) {
                  return const AppEmptyState(
                    title: 'No purchases found',
                    subtitle: 'Try another search or check your access.',
                  );
                }
                return ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: filtered.length,
                  separatorBuilder: (context, index) =>
                      const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final purchase = filtered[index];
                    return _PurchaseListTile(
                      purchase: purchase,
                      onTap: () => context.push('/purchases/${purchase.id}'),
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

class _PurchaseListTile extends StatelessWidget {
  const _PurchaseListTile({required this.purchase, required this.onTap});

  final PurchaseListItem purchase;
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
                      purchase.documentNo,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      purchase.supplierName,
                      style: const TextStyle(color: AppColors.muted, fontSize: 12),
                    ),
                    Text(
                      '${purchase.date} · ${purchase.status} · ${purchase.itemCount} items',
                      style: const TextStyle(color: AppColors.muted, fontSize: 12),
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    formatMoney(purchase.total),
                    style: const TextStyle(
                      color: AppColors.primary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (purchase.due > 0)
                    Text(
                      'Due ${formatMoney(purchase.due)}',
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
