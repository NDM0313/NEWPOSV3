import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/session/session_scope.dart';
import '../../../data/repositories/journal_read_repository.dart';
import '../../auth/providers/auth_session_provider.dart';
import '../../auth/providers/repository_providers.dart';

final journalEntriesProvider = FutureProvider<List<JournalEntryRow>>((ref) async {
  final session = ref.watch(authSessionProvider);
  final scope = SessionScope.from(session);
  if (scope == null) {
    throw Exception('Session incomplete.');
  }

  final repo = ref.read(journalReadRepositoryProvider);
  final result = await repo.getRecentEntries(companyId: scope.companyId);

  if (result.error != null) {
    throw Exception(result.error);
  }
  return result.entries;
});
