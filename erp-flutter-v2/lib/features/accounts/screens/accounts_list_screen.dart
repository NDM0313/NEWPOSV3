import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_state.dart';
import '../../../core/widgets/app_loading.dart';
import '../../../core/widgets/module_scaffold.dart';
import '../../../core/widgets/read_only_banner.dart';
import '../../../data/repositories/accounts_read_repository.dart';
import '../providers/accounts_providers.dart';

class AccountsListScreen extends ConsumerWidget {
  const AccountsListScreen({super.key, this.title = 'Chart of Accounts'});

  final String title;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncAccounts = ref.watch(accountsListProvider);

    return ModuleScaffold(
      title: title,
      body: Column(
        children: [
          const ReadOnlyBanner(message: 'Account balances — journal entry create is web-only.'),
          Expanded(
            child: asyncAccounts.when(
              loading: () => const AppLoading(message: 'Loading accounts…'),
              error: (e, _) => AppErrorState(
                message: e.toString().replaceFirst('Exception: ', ''),
                onRetry: () => ref.invalidate(accountsListProvider),
              ),
              data: (accounts) {
                if (accounts.isEmpty) {
                  return const AppEmptyState(
                    title: 'No accounts found',
                    subtitle: 'Chart of accounts may be empty or restricted.',
                  );
                }
                return ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: accounts.length,
                  separatorBuilder: (context, index) => const SizedBox(height: 8),
                  itemBuilder: (_, i) => _AccountTile(account: accounts[i]),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _AccountTile extends StatelessWidget {
  const _AccountTile({required this.account});

  final AccountListItem account;

  @override
  Widget build(BuildContext context) {
    return Container(
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
                  '${account.code} · ${account.name}',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                Text(account.type, style: const TextStyle(color: AppColors.muted, fontSize: 12)),
              ],
            ),
          ),
          Text(
            formatMoney(account.balance),
            style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}
