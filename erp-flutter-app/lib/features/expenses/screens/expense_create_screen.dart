import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/app_colors.dart';
import '../../../core/session/session_scope.dart';
import '../../../core/widgets/module_scaffold.dart';
import '../../auth/providers/auth_session_provider.dart';
import '../../../core/network/network_status_provider.dart';
import '../../../core/sync/sync_providers.dart';
import '../../../data/local/offline_pending_store.dart';
import '../../../data/sync/enqueue_or_run.dart';
import '../../auth/providers/repository_providers.dart';
import '../providers/expenses_providers.dart';

class ExpenseCreateScreen extends ConsumerStatefulWidget {
  const ExpenseCreateScreen({super.key});

  @override
  ConsumerState<ExpenseCreateScreen> createState() => _ExpenseCreateScreenState();
}

class _ExpenseCreateScreenState extends ConsumerState<ExpenseCreateScreen> {
  final _categoryController = TextEditingController(text: 'General');
  final _descriptionController = TextEditingController();
  final _amountController = TextEditingController();
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _categoryController.dispose();
    _descriptionController.dispose();
    _amountController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final scope = SessionScope.from(ref.read(authSessionProvider));
    if (scope == null || scope.branchId == null) {
      setState(() => _error = 'Session or branch missing.');
      return;
    }

    final amount = double.tryParse(_amountController.text.trim()) ?? 0;
    if (amount <= 0) {
      setState(() => _error = 'Enter a valid amount.');
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });

    final online = ref.read(connectivityProvider).value ?? true;
    final category = _categoryController.text;
    final description = _descriptionController.text;

    final repo = ref.read(expensesWriteRepositoryProvider);
    final enqueueResult = await enqueueOrRun(
      isOnline: online,
      type: PendingType.expense,
      payload: {
        'company_id': scope.companyId,
        'branch_id': scope.branchId!,
        'created_by': scope.authUserId,
        'category': category,
        'description': description,
        'amount': amount,
      },
      companyId: scope.companyId,
      branchId: scope.branchId!,
      onlineTask: () => repo.createExpense(
        companyId: scope.companyId,
        branchId: scope.branchId!,
        createdBy: scope.authUserId,
        category: category,
        description: description,
        amount: amount,
      ),
    );

    if (!mounted) return;

    switch (enqueueResult) {
      case OfflineQueued():
        ref.invalidate(pendingSyncCountProvider);
        setState(() => _saving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Expense queued offline — sync when online.')),
        );
        context.pop();
        return;
      case OnlineResult(value: final result):
        if (result.error != null || result.expenseId == null) {
          setState(() {
            _saving = false;
            _error = result.error ?? 'Create failed.';
          });
          return;
        }
        ref.invalidate(expensesListProvider);
        context.pop();
        context.push('/expenses/${result.expenseId}');
    }
  }

  @override
  Widget build(BuildContext context) {
    return ModuleScaffold(
      title: 'New expense',
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(_error!, style: const TextStyle(color: AppColors.error)),
            ),
          TextField(
            controller: _categoryController,
            decoration: const InputDecoration(labelText: 'Category', border: OutlineInputBorder()),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _descriptionController,
            decoration: const InputDecoration(labelText: 'Description', border: OutlineInputBorder()),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _amountController,
            decoration: const InputDecoration(labelText: 'Amount', border: OutlineInputBorder()),
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Create expense'),
          ),
        ],
      ),
    );
  }
}
