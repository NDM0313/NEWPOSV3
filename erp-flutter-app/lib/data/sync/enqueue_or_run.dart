import '../local/offline_pending_store.dart';

sealed class EnqueueOrRunResult<T> {
  const EnqueueOrRunResult();
}

class OnlineResult<T> extends EnqueueOrRunResult<T> {
  const OnlineResult(this.value);
  final T value;
}

class OfflineQueued extends EnqueueOrRunResult<Never> {
  const OfflineQueued(this.localId);
  final String localId;
}

Future<EnqueueOrRunResult<T>> enqueueOrRun<T>({
  required bool isOnline,
  required PendingType type,
  required Map<String, dynamic> payload,
  required String companyId,
  required String branchId,
  required Future<T> Function() onlineTask,
}) async {
  if (!isOnline) {
    final store = OfflinePendingStore();
    final localId = await store.add(
      type: type,
      payload: payload,
      companyId: companyId,
      branchId: branchId,
    );
    return OfflineQueued(localId);
  }
  final result = await onlineTask();
  return OnlineResult<T>(result);
}
