import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildModuleTogglesFromConfigRows,
  expectedEnabledModulesAfterWizard,
  isModuleEnabledInDb,
  moduleTogglePatchesToDb,
} from './moduleConfigSemantics.ts';
import { MODULE_REGISTRY, SETTINGS_KEY_TO_MODULE_NAME } from './companyBootstrapRegistry.ts';

describe('isModuleEnabledInDb', () => {
  it('returns true only when row exists and is_enabled is true', () => {
    const rows = [
      { module_name: 'rentals', is_enabled: true },
      { module_name: 'pos', is_enabled: false },
    ];
    assert.equal(isModuleEnabledInDb(rows, 'rentals'), true);
    assert.equal(isModuleEnabledInDb(rows, 'pos'), false);
    assert.equal(isModuleEnabledInDb(rows, 'sales'), false);
  });
});

describe('buildModuleTogglesFromConfigRows', () => {
  it('maps wizard-selected modules to Settings toggles (rental on, pos off)', () => {
    const wizardSelection = ['rentals', 'accounting'];
    const rows = [...wizardSelection].map((name) => ({
      module_name: name,
      is_enabled: true,
    }));
    const toggles = buildModuleTogglesFromConfigRows(rows);
    assert.equal(toggles.rentalModuleEnabled, true);
    assert.equal(toggles.accountingModuleEnabled, true);
    assert.equal(toggles.posModuleEnabled, false);
    assert.equal(toggles.salesModuleEnabled, false);
  });

  it('covers every registry module toggle key', () => {
    const toggles = buildModuleTogglesFromConfigRows([]);
    for (const entry of MODULE_REGISTRY) {
      assert.ok(entry.settingsKey in toggles, `missing toggle key ${entry.settingsKey}`);
    }
  });
});

describe('expectedEnabledModulesAfterWizard', () => {
  it('normalizes module ids', () => {
    const set = expectedEnabledModulesAfterWizard(['Rentals', ' POS ']);
    assert.deepEqual([...set].sort(), ['pos', 'rentals']);
  });
});

describe('moduleTogglePatchesToDb', () => {
  it('maps settings keys to modules_config names', () => {
    const patches = moduleTogglePatchesToDb({ rentalModuleEnabled: true, salesModuleEnabled: false });
    assert.deepEqual(patches, [
      { moduleName: 'rentals', isEnabled: true },
      { moduleName: 'sales', isEnabled: false },
    ]);
  });

  it('SETTINGS_KEY_TO_MODULE_NAME aligns with registry', () => {
    for (const [key, name] of Object.entries(SETTINGS_KEY_TO_MODULE_NAME)) {
      const entry = MODULE_REGISTRY.find((m) => m.settingsKey === key);
      assert.ok(entry, `registry missing ${key}`);
      assert.equal(entry!.moduleName, name);
    }
  });
});
