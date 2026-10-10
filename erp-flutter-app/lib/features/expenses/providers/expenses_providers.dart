import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/session/session_scope.dart';
import '../../../data/models/expense.dart';
import '../../auth/providers/auth_session_provider.dart';
import '../../auth/providers/repository_providers.dart';

final expensesListProvider = FutureProvider<List<ExpenseListItem>>((ref) async {
  final session = ref.watch(authSessionProvider);
  final scope = SessionScope.from(session);
  if (scope == null) {
    throw Exception('Session incomplete. Sign in and select a branch.');
  }

  final repo = ref.read(expensesReadRepositoryProvider);
  final result = await repo.getExpenses(
    companyId: scope.companyId,
    branchId: scope.listBranchId,
    accessibleBranchIds: scope.accessibleBranchIds,
  );

  if (result.error != null) {
    throw Exception(result.error);
  }
  return result.expenses;
});

final expenseDetailProvider =
    FutureProvider.family<ExpenseDetail?, String>((ref, expenseId) async {
  final session = ref.watch(authSessionProvider);
  final scope = SessionScope.from(session);
  if (scope == null) {
    throw Exception('Session incomplete.');
  }

  final repo = ref.read(expensesReadRepositoryProvider);
  final result = await repo.getExpenseById(
    companyId: scope.companyId,
    expenseId: expenseId,
  );

  if (result.error != null) {
    throw Exception(result.error);
  }
  return result.expense;
});
