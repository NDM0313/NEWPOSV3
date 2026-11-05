import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/session/session_scope.dart';
import '../../../data/repositories/studio_read_repository.dart';
import '../../auth/providers/auth_session_provider.dart';
import '../../auth/providers/repository_providers.dart';

final studioSaleDetailProvider =
    FutureProvider.family<StudioSaleDetail?, String>((ref, saleId) async {
  final session = ref.watch(authSessionProvider);
  final scope = SessionScope.from(session);
  if (scope == null) {
    throw Exception('Not signed in.');
  }

  final repo = ref.read(studioReadRepositoryProvider);
  final result = await repo.getStudioSaleDetail(
    companyId: scope.companyId,
    saleId: saleId,
  );

  if (result.error != null) {
    throw Exception(result.error);
  }
  return result.detail;
});
