import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../data/local/counter_worker_store.dart';
import '../../../data/local/db/database.dart';
import 'auth_session_provider.dart';

const _sharedCounterModeKey = 'erp_flutter_shared_counter_mode';

final appDatabaseProvider = Provider<AppDatabase>((ref) => AppDatabase.instance);

final counterWorkerStoreProvider =
    Provider<CounterWorkerStore>((ref) => CounterWorkerStore(db: ref.watch(appDatabaseProvider)));

final sharedCounterModeProvider =
    StateNotifierProvider<SharedCounterModeNotifier, bool>((ref) => SharedCounterModeNotifier());

class SharedCounterModeNotifier extends StateNotifier<bool> {
  SharedCounterModeNotifier() : super(false) {
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    state = prefs.getBool(_sharedCounterModeKey) ?? false;
  }

  Future<void> setEnabled(bool value) async {
    state = value;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_sharedCounterModeKey, value);
  }
}

class ActiveCounterWorker {
  const ActiveCounterWorker({
    required this.userId,
    required this.displayName,
    required this.email,
    required this.role,
    required this.companyId,
    this.profileId,
    this.branchId,
  });

  final String userId;
  final String displayName;
  final String email;
  final String role;
  final String companyId;
  final String? profileId;
  final String? branchId;
}

class CounterWorkerNotifier extends StateNotifier<ActiveCounterWorker?> {
  CounterWorkerNotifier(this.ref) : super(null);

  final Ref ref;

  Future<bool> activateWithPin({
    required String userId,
    required String pin,
  }) async {
    final session = ref.read(authSessionProvider);
    final companyId = session.profile?.companyId;
    if (companyId == null) return false;

    final store = ref.read(counterWorkerStoreProvider);
    final worker = await store.verifyPin(
      companyId: companyId,
      userId: userId,
      pin: pin,
    );
    if (worker == null) return false;

    state = ActiveCounterWorker(
      userId: worker.userId,
      displayName: worker.displayName,
      email: worker.email,
      role: worker.role,
      companyId: worker.companyId,
      profileId: worker.profileId,
      branchId: worker.branchId,
    );

    await ref.read(authSessionProvider.notifier).applyCounterWorkerPermissions(worker.role);
    return true;
  }

  void lock() {
    state = null;
  }
}

final counterWorkerProvider =
    StateNotifierProvider<CounterWorkerNotifier, ActiveCounterWorker?>((ref) {
  return CounterWorkerNotifier(ref);
});

final enrolledWorkersProvider = FutureProvider<List<EnrolledCounterWorker>>((ref) async {
  final session = ref.watch(authSessionProvider);
  final companyId = session.profile?.companyId;
  if (companyId == null) return [];
  return ref.read(counterWorkerStoreProvider).listEnrolled(companyId);
});
