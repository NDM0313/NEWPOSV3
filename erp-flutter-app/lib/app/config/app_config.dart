// Supabase config — native URL locked to https://erp.dincouture.pk (MOBILE_APK_LOCKED_PATTERN.md)
class AppConfig {
  AppConfig._();

  static const String supabaseUrl = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: 'https://erp.dincouture.pk',
  );

  static const String supabaseAnonKey = String.fromEnvironment(
    'SUPABASE_ANON_KEY',
    defaultValue: '',
  );

  static const String branchStorageKey = 'erp_flutter_selected_branch_id';

  static bool get isConfigured => supabaseAnonKey.trim().isNotEmpty;

  static String get configurationErrorMessage =>
      'App not configured. Pass SUPABASE_ANON_KEY via --dart-define or copy from root .env.production (VITE_SUPABASE_ANON_KEY).';
}
