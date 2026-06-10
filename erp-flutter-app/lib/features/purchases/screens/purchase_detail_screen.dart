import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme/app_colors.dart';
import '../../../core/permissions/purchase_actions.dart';
import '../../../core/session/session_scope.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/partial_amount_dialog.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_state.dart';
import '../../../core/widgets/app_loading.dart';
import '../../../core/widgets/detail_section.dart';
import '../../../core/widgets/module_scaffold.dart';
import '../../../core/widgets/read_only_banner.dart';
import '../../../data/models/purchase.dart';
import '../../auth/providers/auth_session_provider.dart';
import '../../auth/providers/repository_providers.dart';
import '../providers/purchases_providers.dart';

class PurchaseDetailScreen extends ConsumerWidget {
  const PurchaseDetailScreen({super.key, required this.purchaseId});

  final String purchaseId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncPurchase = ref.watch(purchaseDetailProvider(purchaseId));

    return ModuleScaffold(
      title: 'Purchase',
      body: asyncPurchase.when(
        loading: () => const AppLoading(message: 'Loading purchase…'),
        error: (e, _) => AppErrorState(
          message: e.toString().replaceFirst('Exception: ', ''),
          onRetry: () => ref.invalidate(purchaseDetailProvider(purchaseId)),
        ),
        data: (purchase) {
          if (purchase == null) {
            return const AppEmptyState(
              title: 'Purchase not found',
              subtitle: 'It may have been removed or you lack access.',
            );
          }
          return _PurchaseDetailBody(purchase: purchase, purchaseId: purchaseId);
        },
      ),
    );
  }
}

class _PurchaseDetailBody extends ConsumerStatefulWidget {
  const _PurchaseDetailBody({required this.purchase, required this.purchaseId});

  final PurchaseDetail purchase;
  final String purchaseId;

  @override
  ConsumerState<_PurchaseDetailBody> createState() => _PurchaseDetailBodyState();
}

class _PurchaseDetailBodyState extends ConsumerState<_PurchaseDetailBody> {
  bool _busy = false;
  String? _actionError;
  String? _actionSuccess;

  Future<void> _confirmPaySupplier() async {
    final due = widget.purchase.due;
    if (due <= 0) return;

    final amount = await showPartialAmountDialog(
      context: context,
      title: 'Pay supplier',
      maxAmount: due,
      hint: 'Record cash payment against this purchase.',
    );
    if (amount == null || amount <= 0) return;

    final scope = SessionScope.from(ref.read(authSessionProvider));
    if (scope == null || scope.branchId == null) {
      setState(() => _actionError = 'Session or branch missing.');
      return;
    }

    setState(() {
      _busy = true;
      _actionError = null;
      _actionSuccess = null;
    });

    final repo = ref.read(purchasesWriteRepositoryProvider);
    final result = await repo.recordSupplierPayment(
      companyId: scope.companyId,
      branchId: scope.branchId!,
      purchaseId: widget.purchaseId,
      amount: amount,
      createdBy: scope.authUserId,
    );

    if (!mounted) return;

    if (!result.success) {
      setState(() {
        _busy = false;
        _actionError = result.error ?? 'Payment failed.';
      });
      return;
    }

    ref.invalidate(purchaseDetailProvider(widget.purchaseId));
    ref.invalidate(purchasesListProvider);
    setState(() {
      _busy = false;
      _actionSuccess = 'Payment of ${formatMoney(amount)} recorded.';
    });
  }

  Future<void> _confirmCancelPurchase() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel purchase?'),
        content: const Text(
          'This voids stock and accounting on the server. '
          'Use only when you need a full purchase cancel.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Back')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
            child: const Text('Cancel purchase'),
          ),
        ],
      ),
    );
    if (ok != true) return;

    final scope = SessionScope.from(ref.read(authSessionProvider));
    if (scope == null) return;

    setState(() {
      _busy = true;
      _actionError = null;
      _actionSuccess = null;
    });

    final repo = ref.read(purchasesWriteRepositoryProvider);
    final result = await repo.cancelPurchase(
      purchaseId: widget.purchaseId,
      userId: scope.authUserId,
    );

    if (!mounted) return;

    if (!result.success) {
      setState(() {
        _busy = false;
        _actionError = result.error ?? 'Cancel failed.';
      });
      return;
    }

    ref.invalidate(purchaseDetailProvider(widget.purchaseId));
    ref.invalidate(purchasesListProvider);
    setState(() {
      _busy = false;
      _actionSuccess = 'Purchase cancelled.';
    });
  }

  Future<void> _confirmFinalize() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Finalize purchase?'),
        content: const Text(
          'This posts purchase accounting on the server. '
          'Test on a draft PO first.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Finalize')),
        ],
      ),
    );
    if (ok != true) return;

    final scope = SessionScope.from(ref.read(authSessionProvider));
    if (scope == null) return;

    setState(() {
      _busy = true;
      _actionError = null;
      _actionSuccess = null;
    });

    final repo = ref.read(purchasesWriteRepositoryProvider);
    final result = await repo.finalizePurchase(
      companyId: scope.companyId,
      purchaseId: widget.purchaseId,
    );

    if (!mounted) return;

    if (!result.success) {
      setState(() {
        _busy = false;
        _actionError = result.error ?? 'Finalize failed.';
      });
      return;
    }

    ref.invalidate(purchaseDetailProvider(widget.purchaseId));
    ref.invalidate(purchasesListProvider);
    setState(() {
      _busy = false;
      _actionSuccess = 'Purchase finalized.';
    });
  }

  @override
  Widget build(BuildContext context) {
    final purchase = widget.purchase;
    final session = ref.watch(authSessionProvider);
    final scope = SessionScope.from(session);
    final perms = scope?.permissions;
    final canFinalize = perms != null &&
        canFinalizePurchase(perms) &&
        isPurchaseStatusFinalizable(purchase.status);
    final canPay = perms != null &&
        canFinalizePurchase(perms) &&
        purchase.due > 0 &&
        (purchase.status.toLowerCase() == 'final' ||
            purchase.status.toLowerCase() == 'received');
    final canCancel = perms != null &&
        canCancelPurchase(perms) &&
        isPurchaseStatusCancellable(purchase.status);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          purchase.documentNo,
          style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
        ),
        if (_actionError != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(_actionError!, style: const TextStyle(color: AppColors.error)),
          ),
        if (_actionSuccess != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(_actionSuccess!, style: const TextStyle(color: AppColors.success)),
          ),
        const SizedBox(height: 16),
        DetailSection(
          children: [
            DetailRow(label: 'Status', value: purchase.status),
            DetailRow(label: 'Payment', value: purchase.paymentStatus),
            DetailRow(label: 'Supplier', value: purchase.supplierName),
            DetailRow(label: 'Date', value: purchase.date),
            DetailRow(label: 'Branch', value: purchase.branchName),
          ],
        ),
        const SizedBox(height: 12),
        DetailSection(
          children: [
            DetailRow(label: 'Subtotal', value: formatMoney(purchase.subtotal)),
            DetailRow(label: 'Discount', value: formatMoney(purchase.discount)),
            DetailRow(label: 'Tax', value: formatMoney(purchase.tax)),
            DetailRow(label: 'Shipping', value: formatMoney(purchase.shipping)),
            DetailRow(label: 'Total', value: formatMoney(purchase.total)),
            DetailRow(label: 'Paid', value: formatMoney(purchase.paid)),
            DetailRow(
              label: 'Due',
              value: formatMoney(purchase.due),
              valueColor: purchase.due > 0 ? AppColors.warning : AppColors.success,
            ),
          ],
        ),
        if (canFinalize) ...[
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: _busy ? null : _confirmFinalize,
            child: _busy
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Finalize purchase'),
          ),
        ],
        if (canPay) ...[
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: _busy ? null : _confirmPaySupplier,
            child: Text('Pay supplier (due ${formatMoney(purchase.due)})'),
          ),
        ],
        if (canCancel) ...[
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: _busy ? null : _confirmCancelPurchase,
            style: OutlinedButton.styleFrom(foregroundColor: AppColors.error),
            child: const Text('Cancel purchase'),
          ),
        ],
        if (purchase.items.isNotEmpty) ...[
          const SizedBox(height: 16),
          const Text(
            'ITEMS',
            style: TextStyle(color: AppColors.muted, fontWeight: FontWeight.w600, fontSize: 13),
          ),
          const SizedBox(height: 8),
          ...purchase.items.map((item) => _LineTile(item: item)),
        ],
        if (purchase.notes != null && purchase.notes!.trim().isNotEmpty) ...[
          const SizedBox(height: 12),
          DetailSection(children: [DetailRow(label: 'Notes', value: purchase.notes!)]),
        ],
        if (!canFinalize) const ReadOnlyBanner(),
      ],
    );
  }
}

class _LineTile extends StatelessWidget {
  const _LineTile({required this.item});

  final PurchaseLineItem item;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.productName, style: const TextStyle(fontWeight: FontWeight.w600)),
                Text('${item.sku} · Qty ${item.quantity}', style: const TextStyle(color: AppColors.muted, fontSize: 12)),
              ],
            ),
          ),
          Text(formatMoney(item.total), style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
