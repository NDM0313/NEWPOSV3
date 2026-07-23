import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/repositories/reports_repository.dart';
import '../../auth/providers/auth_session_provider.dart';
import '../../auth/providers/repository_providers.dart';

final reportsPeriodDaysProvider = StateProvider<int>((ref) => 30);

final salesReportProvider = FutureProvider<List<SalesReportRow>>((ref) async {
  final session = ref.watch(authSessionProvider);
  final companyId = session.companyId;
  final branch = session.selectedBranch;
  if (companyId == null) return [];

  final days = ref.watch(reportsPeriodDaysProvider);
  final from = DateTime.now().subtract(Duration(days: days));

  return ref.watch(reportsRepositoryProvider).fetchSalesReport(
        companyId: companyId,
        branchId: branch?.id,
        from: from,
      );
});

final expenseReportProvider = FutureProvider<List<ExpenseReportRow>>((ref) async {
  final session = ref.watch(authSessionProvider);
  final companyId = session.companyId;
  final branch = session.selectedBranch;
  if (companyId == null) return [];

  return ref.watch(reportsRepositoryProvider).fetchExpenseReport(
        companyId: companyId,
        branchId: branch?.id,
      );
});

final reportsSummaryProvider = FutureProvider<({double salesTotal, double expenseTotal, int saleCount})>((ref) async {
  final session = ref.watch(authSessionProvider);
  final companyId = session.companyId;
  final branch = session.selectedBranch;
  if (companyId == null) {
    return (salesTotal: 0.0, expenseTotal: 0.0, saleCount: 0);
  }

  final days = ref.watch(reportsPeriodDaysProvider);
  final from = DateTime.now().subtract(Duration(days: days));

  return ref.watch(reportsRepositoryProvider).fetchPeriodSummary(
        companyId: companyId,
        branchId: branch?.id,
        from: from,
      );
});
