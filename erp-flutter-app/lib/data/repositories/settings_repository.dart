import '../../core/supabase/supabase_bootstrap.dart';
import '../models/module_toggles.dart';

const _moduleConfigNames = [
  'rentals',
  'studio',
  'accounting',
  'production',
  'pos',
  'combos',
];

class SettingsRepository {
  final _client = SupabaseBootstrap.client;

  Future<({ModuleToggles toggles, String? error})> getModuleConfigs(
    String? companyId,
  ) async {
    if (companyId == null) {
      return (toggles: ModuleToggles.defaults, error: 'No company');
    }

    try {
      final data = await _client
          .from('modules_config')
          .select('module_name, is_enabled')
          .eq('company_id', companyId)
          .inFilter('module_name', _moduleConfigNames);

      final map = <String, bool>{};
      for (final row in data as List) {
        final m = row as Map<String, dynamic>;
        map[m['module_name'] as String] = m['is_enabled'] == true;
      }

      return (
        toggles: ModuleToggles(
          rentalModuleEnabled: map['rentals'] ?? true,
          studioModuleEnabled: map['studio'] ?? true,
          accountingModuleEnabled: map['accounting'] ?? true,
          posModuleEnabled: map['pos'] ?? true,
        ),
        error: null,
      );
    } catch (e) {
      return (toggles: ModuleToggles.failClosed, error: e.toString());
    }
  }
}
