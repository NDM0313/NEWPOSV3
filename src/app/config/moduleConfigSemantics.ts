/**
 * Pure helpers for modules_config ↔ ModuleToggles (used by SettingsContext and tests).
 */
import {
  MODULE_REGISTRY,
  SETTINGS_KEY_TO_MODULE_NAME,
  type ModuleToggles,
  defaultModuleToggles,
} from './companyBootstrapRegistry';

export type ModuleConfigRow = { module_name: string; is_enabled: boolean | null };

/** Matches SettingsContext: enabled only when row exists and is_enabled === true. */
export function isModuleEnabledInDb(rows: ModuleConfigRow[], moduleName: string): boolean {
  const row = rows.find((r) => (r.module_name || '').toLowerCase() === moduleName.toLowerCase());
  return row?.is_enabled === true;
}

export function buildModuleTogglesFromConfigRows(rows: ModuleConfigRow[]): ModuleToggles {
  const toggles = defaultModuleToggles();
  for (const entry of MODULE_REGISTRY) {
    if (entry.settingsKey in toggles) {
      (toggles as Record<string, boolean>)[entry.settingsKey] = isModuleEnabledInDb(rows, entry.moduleName);
    }
  }
  return toggles;
}

/** Wizard selected ids → expected DB rows after create_business_transaction. */
export function expectedEnabledModulesAfterWizard(wizardModuleIds: string[]): Set<string> {
  return new Set(wizardModuleIds.map((id) => id.trim().toLowerCase()).filter(Boolean));
}

/** Partial toggles → payloads for settingsService.setModuleEnabled */
export function moduleTogglePatchesToDb(
  patch: Partial<ModuleToggles>
): { moduleName: string; isEnabled: boolean }[] {
  const out: { moduleName: string; isEnabled: boolean }[] = [];
  for (const [key, value] of Object.entries(patch)) {
    if (typeof value !== 'boolean') continue;
    const moduleName = SETTINGS_KEY_TO_MODULE_NAME[key as keyof typeof SETTINGS_KEY_TO_MODULE_NAME];
    if (moduleName) {
      out.push({ moduleName, isEnabled: value });
    }
  }
  return out;
}
