import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_state.dart';
import '../../../core/widgets/app_loading.dart';
import '../../../core/widgets/module_scaffold.dart';
import '../../../core/widgets/read_only_banner.dart';
import '../../../data/repositories/journal_read_repository.dart';
import '../providers/journal_providers.dart';

class JournalListScreen extends ConsumerWidget {
  const JournalListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncEntries = ref.watch(journalEntriesProvider);

    return ModuleScaffold(
      title: 'Ledger',
      body: Column(
        children: [
          const ReadOnlyBanner(message: 'Journal list — manual entries are web-only.'),
          Expanded(
            child: asyncEntries.when(
              loading: () => const AppLoading(message: 'Loading journal entries…'),
              error: (e, _) => AppErrorState(
                message: e.toString().replaceFirst('Exception: ', ''),
                onRetry: () => ref.invalidate(journalEntriesProvider),
              ),
              data: (entries) {
                if (entries.isEmpty) {
                  return const AppEmptyState(
                    title: 'No journal entries',
                    subtitle: 'Posted entries will appear here.',
                  );
                }
                return ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: entries.length,
                  separatorBuilder: (context, index) => const SizedBox(height: 8),
                  itemBuilder: (_, i) => _JournalTile(entry: entries[i]),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _JournalTile extends StatelessWidget {
  const _JournalTile({required this.entry});

  final JournalEntryRow entry;

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
                  entry.entryNo,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
              Text(entry.date, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
            ],
          ),
          const SizedBox(height: 4),
          Text(entry.description, style: const TextStyle(color: AppColors.muted, fontSize: 13)),
          const SizedBox(height: 6),
          Row(
            children: [
              Text(entry.referenceType, style: const TextStyle(fontSize: 12)),
              const Spacer(),
              Text(
                'Dr ${formatMoney(entry.totalDebit)} / Cr ${formatMoney(entry.totalCredit)}',
                style: const TextStyle(fontSize: 12, color: AppColors.primary),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
