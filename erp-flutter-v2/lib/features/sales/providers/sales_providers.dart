import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/permissions/counter_data_isolation.dart';
import '../../../core/session/session_scope.dart';
import '../../../data/models/sale.dart';
import '../../auth/providers/auth_session_provider.dart';
import '../../auth/providers/repository_providers.dart';

final salesListProvider = FutureProvider<List<SaleListItem>>((ref) async {
  final session = ref.watch(authSessionProvider);
  final scope = SessionScope.from(session);
  if (scope == null) {
    throw Exception('Session incomplete. Sign in and select a branch.');
  }

  final isolate = shouldIsolateSalesList(scope.permissions, scope.role);
  final repo = ref.read(salesReadRepositoryProvider);
  final result = await repo.getSales(
    companyId: scope.companyId,
    branchId: scope.listBranchId,
    accessibleBranchIds: scope.accessibleBranchIds,
    isolateToWorker: isolate,
    authUserId: scope.authUserId,
    profileId: scope.profileId,
  );

  if (result.error != null) {
    throw Exception(result.error);
  }
  return result.sales;
});

final saleDetailProvider =
    FutureProvider.family<SaleDetail?, String>((ref, saleId) async {
  final session = ref.watch(authSessionProvider);
  final scope = SessionScope.from(session);
  if (scope == null) {
    throw Exception('Session incomplete.');
  }

  final repo = ref.read(salesReadRepositoryProvider);
  final result = await repo.getSaleById(
    companyId: scope.companyId,
    saleId: saleId,
  );

  if (result.error != null) {
    throw Exception(result.error);
  }
  return result.sale;
});
