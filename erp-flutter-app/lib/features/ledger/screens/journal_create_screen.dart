import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/app_colors.dart';
import '../../../core/network/network_status_provider.dart';
import '../../../core/session/session_scope.dart';
import '../../../core/sync/sync_providers.dart';
import '../../../data/local/offline_pending_store.dart';
import '../../../data/repositories/journal_write_repository.dart';
import '../../../data/sync/enqueue_or_run.dart';
import '../../accounts/providers/accounts_providers.dart';
import '../../auth/providers/auth_session_provider.dart';
import '../../auth/providers/repository_providers.dart';
import '../providers/journal_providers.dart';

class JournalCreateScreen extends ConsumerStatefulWidget {
  const JournalCreateScreen({super.key});

  @override
  ConsumerState<JournalCreateScreen> createState() => _JournalCreateScreenState();
}

class _JournalCreateScreenState extends ConsumerState<JournalCreateScreen> {
  final _descriptionController = TextEditingController();
  String? _debitAccountId;
  String? _creditAccountId;
  final _amountController = TextEditingController();
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _descriptionController.dispose();
    _amountController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final scope = SessionScope.from(ref.read(authSessionProvider));
    if (scope == null || scope.branchId == null) {
      setState(() => _error = 'Branch required.');
      return;
    }
    final amount = double.tryParse(_amountController.text);
    if (amount == null || amount <= 0) {
      setState(() => _error = 'Enter a valid amount.');
      return;
    }
    if (_debitAccountId == null || _creditAccountId == null) {
      setState(() => _error = 'Select debit and credit accounts.');
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });

    final online = ref.read(connectivityProvider).value ?? true;
    final payload = {
      'company_id': scope.companyId,
      'branch_id': scope.branchId!,
      'entry_date': DateTime.now().toIso8601String().substring(0, 10),
      'description': _descriptionController.text.trim().isEmpty
          ? 'Mobile journal entry'
          : _descriptionController.text.trim(),
      'reference_type': 'manual',
      'created_by': scope.authUserId,
      'lines': [
        {'account_id': _debitAccountId, 'debit': amount, 'credit': 0},
        {'account_id': _creditAccountId, 'debit': 0, 'credit': amount},
      ],
    };

    final repo = ref.read(journalWriteRepositoryProvider);
    final result = await enqueueOrRun(
      isOnline: online,
      type: PendingType.journalEntry,
      payload: payload,
      companyId: scope.companyId,
      branchId: scope.branchId!,
      onlineTask: () async {
        final r = await repo.createJournalEntry(
          companyId: scope.companyId,
          branchId: scope.branchId!,
          entryDate: payload['entry_date'] as String,
          description: payload['description'] as String,
          referenceType: 'manual',
          userId: scope.authUserId,
          lines: [
            JournalLineInput(accountId: _debitAccountId!, debit: amount, credit: 0),
            JournalLineInput(accountId: _creditAccountId!, debit: 0, credit: amount),
          ],
        );
        return (error: r.error, id: r.id);
      },
    );

    if (!mounted) return;

    switch (result) {
      case OfflineQueued():
        ref.invalidate(pendingSyncCountProvider);
        context.pop();
        return;
      case OnlineResult(value: final value):
        if (value.error != null) {
          setState(() {
            _saving = false;
            _error = value.error;
          });
          return;
        }
        ref.invalidate(journalEntriesProvider);
        context.pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final accountsAsync = ref.watch(accountsListProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('New journal entry')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(
            controller: _descriptionController,
            decoration: const InputDecoration(labelText: 'Description', border: OutlineInputBorder()),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _amountController,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(labelText: 'Amount', border: OutlineInputBorder()),
          ),
          const SizedBox(height: 12),
          accountsAsync.when(
            loading: () => const LinearProgressIndicator(),
            error: (e, _) => Text(e.toString()),
            data: (accounts) {
              final items = accounts
                  .map(
                    (a) => DropdownMenuItem(
                      value: a.id,
                      child: Text('${a.code} · ${a.name}'),
                    ),
                  )
                  .toList();
              return Column(
                children: [
                  DropdownButtonFormField<String>(
                    decoration: const InputDecoration(labelText: 'Debit account', border: OutlineInputBorder()),
                    items: items,
                    onChanged: (v) => setState(() => _debitAccountId = v),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    decoration: const InputDecoration(labelText: 'Credit account', border: OutlineInputBorder()),
                    items: items,
                    onChanged: (v) => setState(() => _creditAccountId = v),
                  ),
                ],
              );
            },
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: AppColors.error)),
          ],
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: _saving ? null : _submit,
            child: _saving
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Post entry'),
          ),
        ],
      ),
    );
  }
}
