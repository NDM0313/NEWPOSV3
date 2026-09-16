import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/session/session_scope.dart';
import '../../../data/repositories/accounts_read_repository.dart';
import '../../auth/providers/auth_session_provider.dart';
import '../../auth/providers/repository_providers.dart';

final accountsListProvider = FutureProvider<List<AccountListItem>>((ref) async {
  final session = ref.watch(authSessionProvider);
  final scope = SessionScope.from(session);
  if (scope == null) {
    throw Exception('Session incomplete. Sign in and select a branch.');
  }

  final repo = ref.read(accountsReadRepositoryProvider);
  final result = await repo.getAccounts(companyId: scope.companyId);

  if (result.error != null) {
    throw Exception(result.error);
  }
  return result.accounts;
});
