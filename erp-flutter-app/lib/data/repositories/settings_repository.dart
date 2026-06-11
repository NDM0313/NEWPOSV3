import '../../core/supabase/supabase_bootstrap.dart';
import '../models/module_toggles.dart';
import '../models/mobile_printer_settings.dart';

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

  static const _mobilePrinterKey = 'mobile_printer';

  Future<({MobilePrinterSettings settings, String? error})> getMobilePrinterSettings(
    String? companyId,
  ) async {
    if (companyId == null) {
      return (settings: MobilePrinterSettings.defaults, error: null);
    }
    try {
      final row = await _client
          .from('settings')
          .select('value')
          .eq('company_id', companyId)
          .eq('key', _mobilePrinterKey)
          .maybeSingle();
      if (row == null) {
        return (settings: MobilePrinterSettings.defaults, error: null);
      }
      final raw = Map<String, dynamic>.from(row['value'] as Map? ?? {});
      return (settings: MobilePrinterSettings.fromJson(raw), error: null);
    } catch (e) {
      return (settings: MobilePrinterSettings.defaults, error: e.toString());
    }
  }

  Future<String?> setMobilePrinterSettings(
    String companyId,
    MobilePrinterSettings settings,
  ) async {
    try {
      await _client.from('settings').upsert(
        {
          'company_id': companyId,
          'key': _mobilePrinterKey,
          'value': settings.toJson(),
          'category': 'mobile',
          'description': 'Printer: thermal receipt or A4 (normal)',
        },
        onConflict: 'company_id,key',
      );
      return null;
    } catch (e) {
      return e.toString();
    }
  }
}
