import 'package:supabase_flutter/supabase_flutter.dart';

import '../../app/config/app_config.dart';

class SupabaseBootstrap {
  static bool _initialized = false;

  static Future<void> initialize() async {
    if (_initialized) return;
    if (!AppConfig.isConfigured) {
      return;
    }
    await Supabase.initialize(
      url: AppConfig.supabaseUrl,
      publishableKey: AppConfig.supabaseAnonKey,
      authOptions: const FlutterAuthClientOptions(
        authFlowType: AuthFlowType.pkce,
      ),
    );
    _initialized = true;
  }

  static SupabaseClient get client => Supabase.instance.client;

  static bool get isReady => _initialized && AppConfig.isConfigured;
}
