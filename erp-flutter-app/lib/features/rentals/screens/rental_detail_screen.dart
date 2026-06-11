import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme/app_colors.dart';
import '../../../core/permissions/rental_actions.dart';
import '../../../core/session/session_scope.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_state.dart';
import '../../../core/widgets/app_loading.dart';
import '../../../core/widgets/detail_section.dart';
import '../../../core/widgets/module_scaffold.dart';
import '../../../core/widgets/partial_amount_dialog.dart';
import '../../../data/repositories/rentals_read_repository.dart';
import '../../auth/providers/auth_session_provider.dart';
import '../../auth/providers/repository_providers.dart';
import '../providers/rental_detail_providers.dart';
import '../providers/rentals_providers.dart';

class RentalDetailScreen extends ConsumerStatefulWidget {
  const RentalDetailScreen({super.key, required this.rentalId});

  final String rentalId;

  @override
  ConsumerState<RentalDetailScreen> createState() => _RentalDetailScreenState();
}

class _RentalDetailScreenState extends ConsumerState<RentalDetailScreen> {
  bool _busy = false;
  String? _actionError;
  String? _actionSuccess;

  Future<void> _receivePayment(RentalDetail rental) async {
    if (rental.due <= 0) return;

    final amount = await showPartialAmountDialog(
      context: context,
      title: 'Receive rental payment',
      maxAmount: rental.due,
      hint: 'Record cash payment against this booking.',
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

    final repo = ref.read(rentalsWriteRepositoryProvider);
    final result = await repo.recordRentalPayment(
      companyId: scope.companyId,
      branchId: scope.branchId!,
      rentalId: widget.rentalId,
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

    ref.invalidate(rentalDetailProvider(widget.rentalId));
    ref.invalidate(rentalsListProvider);
    setState(() {
      _busy = false;
      _actionSuccess = 'Payment of ${formatMoney(amount)} recorded.';
    });
  }

  @override
  Widget build(BuildContext context) {
    final asyncRental = ref.watch(rentalDetailProvider(widget.rentalId));
    final scope = SessionScope.from(ref.watch(authSessionProvider));
    final canPay = scope != null && canPayRental(scope.permissions);

    return ModuleScaffold(
      title: 'Rental',
      body: asyncRental.when(
        loading: () => const AppLoading(message: 'Loading rental…'),
        error: (e, _) => AppErrorState(
          message: e.toString().replaceFirst('Exception: ', ''),
          onRetry: () => ref.invalidate(rentalDetailProvider(widget.rentalId)),
        ),
        data: (rental) {
          if (rental == null) {
            return const AppEmptyState(
              title: 'Rental not found',
              subtitle: 'It may have been removed or you lack access.',
            );
          }
          return _RentalBody(
            rental: rental,
            busy: _busy,
            canPay: canPay,
            actionError: _actionError,
            actionSuccess: _actionSuccess,
            onReceivePayment: () => _receivePayment(rental),
          );
        },
      ),
    );
  }
}

class _RentalBody extends StatelessWidget {
  const _RentalBody({
    required this.rental,
    required this.busy,
    required this.canPay,
    required this.actionError,
    required this.actionSuccess,
    required this.onReceivePayment,
  });

  final RentalDetail rental;
  final bool busy;
  final bool canPay;
  final String? actionError;
  final String? actionSuccess;
  final VoidCallback onReceivePayment;

  @override
  Widget build(BuildContext context) {
    final showPay = canPay && rental.due > 0;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (actionError != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(actionError!, style: const TextStyle(color: AppColors.error)),
          ),
        if (actionSuccess != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(actionSuccess!, style: const TextStyle(color: AppColors.success)),
          ),
        Text(
          rental.bookingNo,
          style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 16),
        DetailSection(
          children: [
            DetailRow(label: 'Status', value: rental.status),
            DetailRow(label: 'Customer', value: rental.customerName),
            DetailRow(label: 'Booked', value: rental.bookingDate),
            DetailRow(label: 'Pickup', value: rental.pickupDate),
            DetailRow(label: 'Return', value: rental.returnDate),
          ],
        ),
        const SizedBox(height: 12),
        DetailSection(
          children: [
            DetailRow(label: 'Total', value: formatMoney(rental.total)),
            DetailRow(label: 'Paid', value: formatMoney(rental.paid)),
            DetailRow(
              label: 'Due',
              value: formatMoney(rental.due),
              valueColor: rental.due > 0 ? AppColors.warning : AppColors.success,
            ),
          ],
        ),
        if (showPay) ...[
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: busy ? null : onReceivePayment,
            child: busy
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text('Receive payment (${formatMoney(rental.due)} due)'),
          ),
        ],
        if (rental.items.isNotEmpty) ...[
          const SizedBox(height: 16),
          const Text(
            'ITEMS',
            style: TextStyle(color: AppColors.muted, fontWeight: FontWeight.w600, fontSize: 13),
          ),
          const SizedBox(height: 8),
          ...rental.items.map((item) => _LineTile(item: item)),
        ],
      ],
    );
  }
}

class _LineTile extends StatelessWidget {
  const _LineTile({required this.item});

  final RentalLineItem item;

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
          Expanded(child: Text(item.productName, style: const TextStyle(fontWeight: FontWeight.w600))),
          Text('Qty ${item.quantity}'),
          const SizedBox(width: 12),
          Text(
            formatMoney(item.total),
            style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}
