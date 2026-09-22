import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/session/session_scope.dart';
import '../../../data/repositories/studio_read_repository.dart';
import '../../auth/providers/auth_session_provider.dart';
import '../../auth/providers/repository_providers.dart';

final studioSalesListProvider = FutureProvider<List<StudioSaleRow>>((ref) async {
  final session = ref.watch(authSessionProvider);
  final scope = SessionScope.from(session);
  if (scope == null) {
    throw Exception('Session incomplete. Sign in and select a branch.');
  }

  final repo = ref.read(studioReadRepositoryProvider);
  final result = await repo.getStudioSales(
    companyId: scope.companyId,
    branchId: scope.listBranchId,
    accessibleBranchIds: scope.accessibleBranchIds,
  );

  if (result.error != null) {
    throw Exception(result.error);
  }
  return result.sales;
});
