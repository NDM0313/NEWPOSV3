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
      {entries.map((m) => (
        <div
          key={m.moduleName}
          className="flex items-center justify-between bg-gray-950 p-5 rounded-lg border border-gray-800"
        >
          <div>
            <p className="text-white font-medium text-lg">{m.label}</p>
            <p className="text-sm text-gray-400">{m.description}</p>
            {m.notes ? <p className="text-xs text-gray-500 mt-1">{m.notes}</p> : null}
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
