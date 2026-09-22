import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/local/offline_pending_store.dart';
import '../../data/sync/offline_sync_service.dart';
import '../../features/auth/providers/repository_providers.dart';

final offlinePendingStoreProvider =
    Provider<OfflinePendingStore>((ref) => OfflinePendingStore());

final offlineSyncServiceProvider = Provider<OfflineSyncService>((ref) {
  return OfflineSyncService(
    salesWrite: ref.read(salesWriteRepositoryProvider),
    expensesWrite: ref.read(expensesWriteRepositoryProvider),
    purchasesWrite: ref.read(purchasesWriteRepositoryProvider),
    store: ref.read(offlinePendingStoreProvider),
  );
});

final pendingSyncCountProvider = FutureProvider<int>((ref) async {
  final store = ref.read(offlinePendingStoreProvider);
  return store.pendingCount();
});
