import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/theme/app_colors.dart';
import '../network/network_status_provider.dart';
import '../sync/sync_providers.dart';

class SyncPendingBanner extends ConsumerWidget {
  const SyncPendingBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final online = ref.watch(connectivityProvider).value ?? true;
    final pendingAsync = ref.watch(pendingSyncCountProvider);
    final count = pendingAsync.value ?? 0;

    if (count == 0) return const SizedBox.shrink();

    return Material(
      color: AppColors.primary.withValues(alpha: 0.12),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Row(
          children: [
            const Icon(Icons.sync, color: AppColors.primary, size: 18),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                online
                    ? '$count pending change(s) — tap Sync'
                    : '$count queued offline — will sync when online',
                style: const TextStyle(color: AppColors.primary, fontSize: 13),
              ),
            ),
            if (online)
              TextButton(
                onPressed: () async {
                  final service = ref.read(offlineSyncServiceProvider);
                  await service.runSync();
                  ref.invalidate(pendingSyncCountProvider);
                },
                child: const Text('Sync'),
              ),
          ],
        ),
      ),
    );
  }
}
