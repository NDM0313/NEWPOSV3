/**
 * Settings → Module Toggles — driven by companyBootstrapRegistry (wizard parity).
 */
import React from 'react';
import { Switch } from '@/app/components/ui/switch';
import { MODULE_REGISTRY, type ModuleToggles } from '@/app/config/companyBootstrapRegistry';

export interface ModuleTogglesSectionProps {
  value: ModuleToggles;
  onChange: (patch: Partial<ModuleToggles>) => void;
  disabled?: boolean;
}

export function ModuleTogglesSection({ value, onChange, disabled }: ModuleTogglesSectionProps) {
  const entries = MODULE_REGISTRY.filter((m) => m.inSettingsToggles);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Turning a module on enables company features. Sidebar items that are permission-gated (for example
        Accounting) also need the matching role permission — Module Toggle alone does not show the nav item.
      </p>
      {entries.map((m) => (
        <div
          key={m.moduleName}
          className="flex items-center justify-between bg-input-background p-5 rounded-lg border border-border"
        >
          <div>
            <p className="text-foreground font-medium text-lg">{m.label}</p>
            <p className="text-sm text-muted-foreground">{m.description}</p>
            {m.notes ? <p className="text-xs text-muted-foreground mt-1">{m.notes}</p> : null}
          </div>
          <Switch
            checked={value[m.settingsKey]}
            disabled={disabled}
            onCheckedChange={(checked) => onChange({ [m.settingsKey]: checked } as Partial<ModuleToggles>)}
          />
        </div>
      ))}
    </div>
  );
}
