/**
 * Build markdown gap/duplicate matrix from companyBootstrapRegistry (no I/O).
 */
import {
  MODULE_REGISTRY,
  COMPANY_FIELD_REGISTRY,
  type ModuleRegistryEntry,
} from './companyBootstrapRegistry';

export type GapCategory = 'both' | 'wizard_only' | 'settings_only' | 'db_only' | 'permissions_only';

function moduleGapCategory(m: ModuleRegistryEntry): GapCategory {
  if (m.inWizard && m.inSettingsToggles) return 'both';
  if (m.inWizard && !m.inSettingsToggles) return 'wizard_only';
  if (!m.inWizard && m.inSettingsToggles) return 'settings_only';
  return 'db_only';
}

export function buildModuleGapMatrixMarkdown(): string {
  const lines: string[] = [
    '# Company bootstrap — module gap matrix',
    '',
    'Auto-generated from `src/app/config/companyBootstrapRegistry.ts`.',
    '',
    '| Module | modules_config | Wizard | Settings toggles | Sidebar gated | Category | Notes |',
    '|--------|----------------|--------|------------------|---------------|----------|-------|',
  ];

  for (const m of MODULE_REGISTRY) {
    lines.push(
      `| ${m.moduleName} | ${m.dbEffect} | ${m.inWizard ? 'yes' : '—'} | ${m.inSettingsToggles ? 'yes' : '—'} | ${m.sidebarGated ? 'yes' : '—'} | ${moduleGapCategory(m)} | ${m.notes ?? ''} |`
    );
  }

  lines.push('', '## Company fields (non-module)', '');
  lines.push('| Field | Wizard step | Settings tab | RPC param | Surfaces |', '');
  lines.push('|-------|-------------|--------------|-----------|----------|', '');

  for (const f of COMPANY_FIELD_REGISTRY) {
    lines.push(
      `| ${f.id} | ${f.wizardStep ?? '—'} | ${f.settingsTab ?? '—'} | ${f.rpcParam ?? '—'} | ${f.surfaces.join(', ')} |`
    );
  }

  lines.push(
    '',
    '## Product rules',
    '',
    '- **modules_config**: absent row or `is_enabled = false` → module off in Settings and sidebar (when sidebarGated).',
    '- **Wizard** writes only selected modules as `is_enabled = true` via `create_business_transaction` (`p_modules`).',
    '- **Permissions** (`*.view`) still apply for nav items marked permissions_only or in addition to module toggles.',
    ''
  );

  return lines.join('\n');
}
