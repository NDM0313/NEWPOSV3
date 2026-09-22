import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/session/session_scope.dart';
import '../../../data/repositories/rentals_read_repository.dart';
import '../../auth/providers/auth_session_provider.dart';
import '../../auth/providers/repository_providers.dart';

final rentalDetailProvider =
    FutureProvider.family<RentalDetail?, String>((ref, rentalId) async {
  final session = ref.watch(authSessionProvider);
  final scope = SessionScope.from(session);
  if (scope == null) {
    throw Exception('Session incomplete.');
  }

  final repo = ref.read(rentalsReadRepositoryProvider);
  final result = await repo.getRentalById(
    companyId: scope.companyId,
    rentalId: rentalId,
  );

  if (result.error != null) {
    throw Exception(result.error);
  }
  return result.rental;
});
