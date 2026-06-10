import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/app_colors.dart';
import '../../../core/permissions/sale_actions.dart';
import '../../../core/session/session_scope.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_state.dart';
import '../../../core/widgets/app_loading.dart';
import '../../../core/widgets/detail_section.dart';
import '../../../core/widgets/module_scaffold.dart';
import '../../../core/widgets/read_only_banner.dart';
import '../../../data/models/sale.dart';
import '../../auth/providers/auth_session_provider.dart';
import '../../auth/providers/repository_providers.dart';
import '../providers/sales_providers.dart';

class SaleDetailScreen extends ConsumerWidget {
  const SaleDetailScreen({super.key, required this.saleId});

  final String saleId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncSale = ref.watch(saleDetailProvider(saleId));

    return ModuleScaffold(
      title: 'Sale',
      body: asyncSale.when(
        loading: () => const AppLoading(message: 'Loading sale…'),
        error: (e, _) => AppErrorState(
          message: e.toString().replaceFirst('Exception: ', ''),
          onRetry: () => ref.invalidate(saleDetailProvider(saleId)),
        ),
        data: (sale) {
          if (sale == null) {
            return const AppEmptyState(
              title: 'Sale not found',
              subtitle: 'It may have been removed or you lack access.',
            );
          }
          return _SaleDetailBody(sale: sale, saleId: saleId);
        },
      ),
    );
  }
}

class _SaleDetailBody extends ConsumerStatefulWidget {
  const _SaleDetailBody({required this.sale, required this.saleId});

  final SaleDetail sale;
  final String saleId;

  @override
  ConsumerState<_SaleDetailBody> createState() => _SaleDetailBodyState();
}

class _SaleDetailBodyState extends ConsumerState<_SaleDetailBody> {
  bool _busy = false;
  String? _actionError;
  String? _actionSuccess;

  Future<void> _confirmFinalize() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Finalize sale?'),
        content: const Text(
          'This posts stock movements and accounting on the server. '
          'This cannot be undone from the mobile app.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Finalize')),
        ],
      ),
    );
    if (ok != true) return;

    setState(() {
      _busy = true;
      _actionError = null;
      _actionSuccess = null;
    });

    final repo = ref.read(salesWriteRepositoryProvider);
    final result = await repo.finalizeSale(widget.saleId);

    if (!mounted) return;

    if (!result.success) {
      setState(() {
        _busy = false;
        _actionError = result.error ?? 'Finalize failed.';
      });
      return;
    }

    ref.invalidate(saleDetailProvider(widget.saleId));
    ref.invalidate(salesListProvider);
    setState(() {
      _busy = false;
      _actionSuccess = 'Sale finalized.';
      if (result.invoiceNo != null && result.invoiceNo!.isNotEmpty) {
        _actionSuccess = 'Sale finalized (${result.invoiceNo}).';
      }
    });
  }

  Future<void> _confirmReceivePayment() async {
    final due = widget.sale.due;
    if (due <= 0) return;

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Receive payment?'),
        content: Text(
          'Record cash payment of ${formatMoney(due)} against this sale?',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Receive')),
        ],
      ),
    );
    if (ok != true) return;

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

    final repo = ref.read(salesWriteRepositoryProvider);
    final result = await repo.recordSalePaymentReceived(
      companyId: scope.companyId,
      branchId: scope.branchId!,
      saleId: widget.saleId,
      amount: due,
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

    ref.invalidate(saleDetailProvider(widget.saleId));
    ref.invalidate(salesListProvider);
    setState(() {
      _busy = false;
      _actionSuccess = 'Payment recorded.';
    });
  }

  @override
  Widget build(BuildContext context) {
    final sale = widget.sale;
    final session = ref.watch(authSessionProvider);
    final scope = SessionScope.from(session);
    final perms = scope?.permissions;
    final canFinalize = perms != null &&
        canFinalizeSale(perms) &&
        isSaleStatusFinalizable(sale.status);
    final canPay = perms != null &&
        canReceiveSalePayment(perms) &&
        isSaleStatusPosted(sale.status) &&
        sale.due > 0;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          sale.documentNo,
          style: const TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.bold,
            color: AppColors.textPrimary,
          ),
        ),
        if (sale.isStudio)
          const Padding(
            padding: EdgeInsets.only(top: 4),
            child: Text('Studio sale', style: TextStyle(color: AppColors.warning, fontSize: 13)),
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
            DetailRow(label: 'Status', value: sale.status),
            DetailRow(label: 'Payment', value: sale.paymentStatus),
            DetailRow(label: 'Customer', value: sale.customerName),
            DetailRow(label: 'Date', value: sale.date),
            DetailRow(label: 'Branch', value: sale.branchName),
          ],
        ),
        const SizedBox(height: 12),
        DetailSection(
          children: [
            DetailRow(label: 'Subtotal', value: formatMoney(sale.subtotal)),
            DetailRow(label: 'Discount', value: formatMoney(sale.discount)),
            DetailRow(label: 'Tax', value: formatMoney(sale.tax)),
            DetailRow(label: 'Total', value: formatMoney(sale.total)),
            DetailRow(label: 'Paid', value: formatMoney(sale.paid)),
            DetailRow(
              label: 'Due',
              value: formatMoney(sale.due),
              valueColor: sale.due > 0 ? AppColors.warning : AppColors.success,
            ),
          ],
        ),
        if (perms != null &&
            canEditSale(perms) &&
            isSaleStatusFinalizable(sale.status)) ...[
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: _busy ? null : () => context.push('/sales/${widget.saleId}/edit'),
            child: const Text('Edit sale'),
          ),
        ],
        if (canFinalize || canPay) ...[
          const SizedBox(height: 16),
          if (canFinalize)
            ElevatedButton(
              onPressed: _busy ? null : _confirmFinalize,
              child: _busy
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Finalize sale'),
            ),
          if (canPay) ...[
            const SizedBox(height: 8),
            OutlinedButton(
              onPressed: _busy ? null : _confirmReceivePayment,
              child: Text('Receive payment (${formatMoney(sale.due)})'),
            ),
          ],
        ],
        if (sale.items.isNotEmpty) ...[
          const SizedBox(height: 16),
          const Text(
            'ITEMS',
            style: TextStyle(color: AppColors.muted, fontWeight: FontWeight.w600, fontSize: 13),
          ),
          const SizedBox(height: 8),
          ...sale.items.map((item) => _LineTile(item: item)),
        ],
        if (sale.payments.isNotEmpty) ...[
          const SizedBox(height: 16),
          const Text(
            'PAYMENTS',
            style: TextStyle(color: AppColors.muted, fontWeight: FontWeight.w600, fontSize: 13),
          ),
          const SizedBox(height: 8),
          DetailSection(
            children: sale.payments
                .map(
                  (p) => DetailRow(
                    label: '${p.paymentDate} · ${p.method}',
                    value: formatMoney(p.amount),
                  ),
                )
                .toList(),
          ),
        ],
        if (sale.notes != null && sale.notes!.trim().isNotEmpty) ...[
          const SizedBox(height: 12),
          DetailSection(
            children: [DetailRow(label: 'Notes', value: sale.notes!)],
          ),
        ],
        if (!canFinalize && !canPay) const ReadOnlyBanner(),
      ],
    );
  }
}

class _LineTile extends StatelessWidget {
  const _LineTile({required this.item});

  final SaleLineItem item;

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
                Text(
                  item.productName,
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  '${item.sku} · Qty ${item.quantity}',
                  style: const TextStyle(color: AppColors.muted, fontSize: 12),
                ),
              ],
            ),
          ),
          Text(
            formatMoney(item.total),
            style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}
