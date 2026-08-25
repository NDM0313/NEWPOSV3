import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final connectivityProvider = StreamProvider<bool>((ref) async* {
  final connectivity = Connectivity();
  final initial = await connectivity.checkConnectivity();
  yield _isOnline(initial);

  await for (final result in connectivity.onConnectivityChanged) {
    yield _isOnline(result);
  }
});

bool _isOnline(List<ConnectivityResult> results) {
  if (results.isEmpty) return false;
  return results.any(
    (r) =>
        r == ConnectivityResult.mobile ||
        r == ConnectivityResult.wifi ||
        r == ConnectivityResult.ethernet ||
        r == ConnectivityResult.vpn,
  );
}
