import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/theme/app_colors.dart';
import '../network/network_status_provider.dart';

class OfflineBanner extends ConsumerWidget {
  const OfflineBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final online = ref.watch(connectivityProvider).value ?? true;
    if (online) return const SizedBox.shrink();

    return Material(
      color: AppColors.warning.withValues(alpha: 0.15),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Row(
          children: [
            const Icon(Icons.cloud_off, color: AppColors.warning, size: 18),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'No network — writes may fail until you reconnect.',
                style: TextStyle(color: AppColors.warning, fontSize: 13),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
