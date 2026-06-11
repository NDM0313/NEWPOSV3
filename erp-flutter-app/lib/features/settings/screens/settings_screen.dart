import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../../../app/theme/app_colors.dart';
import '../../../core/widgets/detail_section.dart';
import '../../../core/widgets/module_scaffold.dart';
import '../../auth/providers/auth_session_provider.dart';

final packageInfoProvider = FutureProvider<PackageInfo>((ref) async {
  return PackageInfo.fromPlatform();
});

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(authSessionProvider);
    final profile = session.profile;
    final branch = session.selectedBranch;
    final packageInfo = ref.watch(packageInfoProvider);

    final versionLabel = packageInfo.when(
      data: (info) => '${info.version} (${info.buildNumber})',
      loading: () => '—',
      error: (e, st) => '—',
    );

    return ModuleScaffold(
      title: 'Settings',
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          DetailSection(
            children: [
              DetailRow(label: 'Name', value: profile?.name ?? '—'),
              DetailRow(label: 'Email', value: profile?.email ?? '—'),
              DetailRow(label: 'Role', value: profile?.role ?? '—'),
              DetailRow(label: 'Branch', value: branch?.name ?? '—'),
              DetailRow(label: 'App version', value: versionLabel),
            ],
          ),
          const SizedBox(height: 12),
          const Text(
            'Counter/PIN tablet mode is not in this Flutter build — use the Capacitor APK on shared counter devices until a future release.',
            style: TextStyle(color: AppColors.muted, fontSize: 12),
          ),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: () => context.push('/branch'),
            child: const Text('Change branch'),
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: () => ref.read(authSessionProvider.notifier).signOut(),
            icon: const Icon(Icons.logout),
            label: const Text('Sign out'),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.error,
              side: const BorderSide(color: AppColors.error),
            ),
          ),
        ],
      ),
    );
  }
}
