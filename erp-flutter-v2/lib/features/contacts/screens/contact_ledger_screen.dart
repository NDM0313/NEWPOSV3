import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_state.dart';
import '../../../core/widgets/app_loading.dart';
import '../../../core/widgets/module_scaffold.dart';
import '../../../data/repositories/party_ledger_repository.dart';
import '../providers/contact_ledger_providers.dart';

class ContactLedgerScreen extends ConsumerWidget {
  const ContactLedgerScreen({super.key, required this.contactId});

  final String contactId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncLedger = ref.watch(contactPartyLedgerProvider(contactId));

    return ModuleScaffold(
      title: 'Party ledger',
      body: asyncLedger.when(
        loading: () => const AppLoading(message: 'Loading ledger…'),
        error: (e, _) => AppErrorState(
          message: e.toString().replaceFirst('Exception: ', ''),
          onRetry: () => ref.invalidate(contactPartyLedgerProvider(contactId)),
        ),
        data: (data) {
          if (data.lines.isEmpty) {
            return AppEmptyState(
              title: 'No ledger lines',
              subtitle: data.openingBalance != 0
                  ? 'Opening: ${formatMoney(data.openingBalance)}'
                  : 'No GL activity for this contact.',
            );
          }

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(
                'Opening: ${formatMoney(data.openingBalance)}',
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 12),
              ...data.lines.map((line) => _LedgerTile(line: line)),
            ],
          );
        },
      ),
    );
  }
}

class _LedgerTile extends StatelessWidget {
  const _LedgerTile({required this.line});

  final PartyLedgerLine line;

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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(line.date, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
              const Spacer(),
              Text(line.reference, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
            ],
          ),
          const SizedBox(height: 4),
          Text(line.description, style: const TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          Row(
            children: [
              if (line.debit > 0)
                Text('Dr ${formatMoney(line.debit)}', style: const TextStyle(fontSize: 12)),
              if (line.credit > 0) ...[
                const SizedBox(width: 8),
                Text('Cr ${formatMoney(line.credit)}', style: const TextStyle(fontSize: 12)),
              ],
              const Spacer(),
              Text(
                formatMoney(line.runningBalance),
                style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
