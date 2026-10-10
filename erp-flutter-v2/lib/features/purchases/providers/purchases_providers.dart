import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/permissions/counter_data_isolation.dart';
import '../../../core/session/session_scope.dart';
import '../../../data/models/purchase.dart';
import '../../auth/providers/auth_session_provider.dart';
import '../../auth/providers/repository_providers.dart';

final purchasesListProvider = FutureProvider<List<PurchaseListItem>>((ref) async {
  final session = ref.watch(authSessionProvider);
  final scope = SessionScope.from(session);
  if (scope == null) {
    throw Exception('Session incomplete. Sign in and select a branch.');
  }

  final isolate = shouldIsolatePurchaseList(scope.permissions, scope.role);
  final repo = ref.read(purchasesReadRepositoryProvider);
  final result = await repo.getPurchases(
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
  return result.purchases;
});

final purchaseDetailProvider =
    FutureProvider.family<PurchaseDetail?, String>((ref, purchaseId) async {
  final session = ref.watch(authSessionProvider);
  final scope = SessionScope.from(session);
  if (scope == null) {
    throw Exception('Session incomplete.');
  }

  final repo = ref.read(purchasesReadRepositoryProvider);
  final result = await repo.getPurchaseById(
    companyId: scope.companyId,
    purchaseId: purchaseId,
  );

  if (result.error != null) {
    throw Exception(result.error);
  }
  return result.purchase;
});
