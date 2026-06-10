import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_state.dart';
import '../../../core/widgets/app_loading.dart';
import '../../../core/widgets/detail_section.dart';
import '../../../core/widgets/module_scaffold.dart';
import '../../../core/widgets/read_only_banner.dart';
import '../../../data/repositories/rentals_read_repository.dart';
import '../providers/rental_detail_providers.dart';

class RentalDetailScreen extends ConsumerWidget {
  const RentalDetailScreen({super.key, required this.rentalId});

  final String rentalId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncRental = ref.watch(rentalDetailProvider(rentalId));

    return ModuleScaffold(
      title: 'Rental',
      body: Column(
        children: [
          const ReadOnlyBanner(),
          Expanded(
            child: asyncRental.when(
              loading: () => const AppLoading(message: 'Loading rental…'),
              error: (e, _) => AppErrorState(
                message: e.toString().replaceFirst('Exception: ', ''),
                onRetry: () => ref.invalidate(rentalDetailProvider(rentalId)),
              ),
              data: (rental) {
                if (rental == null) {
                  return const AppEmptyState(
                    title: 'Rental not found',
                    subtitle: 'It may have been removed or you lack access.',
                  );
                }
                return _RentalBody(rental: rental);
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _RentalBody extends StatelessWidget {
  const _RentalBody({required this.rental});

  final RentalDetail rental;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
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
          Text(formatMoney(item.total), style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
