import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_state.dart';
import '../../../core/widgets/app_loading.dart';
import '../../../core/widgets/module_scaffold.dart';
import '../../../core/widgets/read_only_banner.dart';
import '../../../data/repositories/rentals_read_repository.dart';
import '../providers/rentals_providers.dart';

class RentalsListScreen extends ConsumerWidget {
  const RentalsListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncRentals = ref.watch(rentalsListProvider);

    return ModuleScaffold(
      title: 'Rentals',
      body: Column(
        children: [
          const ReadOnlyBanner(),
          Expanded(
            child: asyncRentals.when(
              loading: () => const AppLoading(message: 'Loading rentals…'),
              error: (e, _) => AppErrorState(
                message: e.toString().replaceFirst('Exception: ', ''),
                onRetry: () => ref.invalidate(rentalsListProvider),
              ),
              data: (rentals) {
                if (rentals.isEmpty) {
                  return const AppEmptyState(
                    title: 'No rentals found',
                    subtitle: 'Bookings will appear here when available.',
                  );
                }
                return ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: rentals.length,
                  separatorBuilder: (context, index) => const SizedBox(height: 8),
                  itemBuilder: (_, i) => _RentalTile(rental: rentals[i]),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _RentalTile extends StatelessWidget {
  const _RentalTile({required this.rental});

  final RentalListItem rental;

  @override
  Widget build(BuildContext context) {
    return Container(
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
                  rental.bookingNo,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
              Text(
                rental.status,
                style: const TextStyle(color: AppColors.muted, fontSize: 12),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(rental.customerName, style: const TextStyle(color: AppColors.muted, fontSize: 13)),
          const SizedBox(height: 6),
          Row(
            children: [
              Text(rental.bookingDate, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
              const Spacer(),
              Text(formatMoney(rental.total), style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w600)),
              if (rental.due > 0) ...[
                const SizedBox(width: 8),
                Text(
                  'Due ${formatMoney(rental.due)}',
                  style: const TextStyle(fontSize: 12, color: AppColors.warning),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}
