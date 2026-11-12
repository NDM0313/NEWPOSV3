import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/session/session_scope.dart';
import '../../../data/models/dashboard_metrics.dart';
import '../../auth/providers/auth_session_provider.dart';
import '../../auth/providers/repository_providers.dart';

class DashboardData {
  const DashboardData({
    required this.metrics,
    required this.lowStock,
    required this.showFinancialMetrics,
    this.error,
  });

  final DashboardMetrics? metrics;
  final List<LowStockItem> lowStock;
  final bool showFinancialMetrics;
  final String? error;
}

final dashboardDataProvider = FutureProvider<DashboardData>((ref) async {
  final session = ref.watch(authSessionProvider);
  final scope = SessionScope.from(session);
  if (scope == null) {
    throw Exception('Session incomplete. Sign in and select a branch.');
  }

  final showFinancial = scope.permissions.canViewBalances;
  final useWorkerScope = !showFinancial;

  final repo = ref.read(dashboardRepositoryProvider);
  final result = await repo.getDashboardMetrics(
    companyId: scope.companyId,
    branchId: scope.branchId,
    useWorkerScope: useWorkerScope,
    authUserId: scope.authUserId,
    profileId: scope.profileId,
  );

  return DashboardData(
    metrics: result.metrics,
    lowStock: result.lowStock,
    showFinancialMetrics: showFinancial,
    error: result.error,
  );
});
