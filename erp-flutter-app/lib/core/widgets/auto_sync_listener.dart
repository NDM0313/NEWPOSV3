import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/network_status_provider.dart';
import '../sync/sync_providers.dart';

/// Runs pending offline sync when connectivity returns.
class AutoSyncListener extends ConsumerStatefulWidget {
  const AutoSyncListener({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<AutoSyncListener> createState() => _AutoSyncListenerState();
}

class _AutoSyncListenerState extends ConsumerState<AutoSyncListener> {
  bool _wasOffline = false;

  @override
  Widget build(BuildContext context) {
    ref.listen(connectivityProvider, (prev, next) {
      final online = next.value ?? true;
      if (online && _wasOffline) {
        ref.read(offlineSyncServiceProvider).runSync().then((_) {
          ref.invalidate(pendingSyncCountProvider);
        });
      }
      _wasOffline = !online;
    });

    return widget.child;
  }
}
