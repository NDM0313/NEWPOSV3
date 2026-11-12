import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/session/session_scope.dart';
import '../../../data/repositories/studio_read_repository.dart';
import '../../auth/providers/auth_session_provider.dart';
import '../../auth/providers/repository_providers.dart';

final studioWorkersProvider = FutureProvider<List<StudioWorkerRow>>((ref) async {
  final session = ref.watch(authSessionProvider);
  final scope = SessionScope.from(session);
  if (scope == null) return [];

  final repo = ref.read(studioReadRepositoryProvider);
  final result = await repo.getWorkers(companyId: scope.companyId);
  if (result.error != null) {
    throw Exception(result.error);
  }
  return result.workers;
});
