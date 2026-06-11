import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/router/app_router.dart';
import 'app/theme/app_theme.dart';
import 'core/supabase/supabase_bootstrap.dart';
import 'core/widgets/auto_sync_listener.dart';
import 'data/local/db/database.dart';
import 'features/auth/providers/auth_session_provider.dart';
import 'features/auth/screens/pos_lock_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SupabaseBootstrap.initialize();
  await AppDatabase.instance.migrateFromSharedPreferencesIfNeeded();

  runApp(const ProviderScope(child: ErpFlutterApp()));
}

class ErpFlutterApp extends ConsumerStatefulWidget {
  const ErpFlutterApp({super.key});

  @override
  ConsumerState<ErpFlutterApp> createState() => _ErpFlutterAppState();
}

class _ErpFlutterAppState extends ConsumerState<ErpFlutterApp> {
  @override
  void initState() {
    super.initState();
    Future.microtask(
      () => ref.read(authSessionProvider.notifier).bootstrap(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(authSessionProvider);
    final router = createAppRouter(session);

    return PosLockScreen(
      child: AutoSyncListener(
        child: MaterialApp.router(
          title: 'Din Collection ERP',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.dark(),
          routerConfig: router,
        ),
      ),
    );
  }
}
