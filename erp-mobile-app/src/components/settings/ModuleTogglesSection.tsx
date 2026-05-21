import { useState } from 'react';
import { Briefcase, Package, ChevronDown, ChevronUp } from 'lucide-react';
import * as settingsApi from '../../api/settings';
import { useSettings } from '../../context/SettingsContext';
import { usePermissions } from '../../context/PermissionContext';

interface ModuleTogglesSectionProps {
  companyId: string;
  userId: string;
  userRole: string;
  profileId?: string;
}

function ToggleRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-[#374151] last:border-0">
      <div className="min-w-0">
        <p className="font-medium text-white text-sm">{label}</p>
        {description ? <p className="text-xs text-[#9CA3AF] mt-0.5">{description}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-[#10B981]' : 'bg-[#4B5563]'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

export function ModuleTogglesSection({ companyId, userId, userRole, profileId }: ModuleTogglesSectionProps) {
  const { enablePacking, reload: reloadSettings } = useSettings();
  const { moduleToggles, reload: reloadPermissions } = usePermissions();
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const run = async (key: string, fn: () => Promise<{ error: string | null }>) => {
    setError(null);
    setSavingKey(key);
    const { error: err } = await fn();
    setSavingKey(null);
    if (err) {
      setError(err);
      return;
    }
    await reloadSettings(companyId);
    await reloadPermissions(userId, userRole, profileId, companyId);
  };

  const onPacking = (v: boolean) => run('packing', () => settingsApi.setEnablePacking(companyId, v));

  const onModule = (apiName: 'rentals' | 'studio' | 'accounting' | 'pos', v: boolean) =>
    run(`mod:${apiName}`, () => settingsApi.setModuleEnabled(companyId, apiName, v));

  const summary = [
    `Packing ${enablePacking ? 'On' : 'Off'}`,
    `Rental ${moduleToggles.rentalModuleEnabled ? 'On' : 'Off'}`,
    `Studio ${moduleToggles.studioModuleEnabled ? 'On' : 'Off'}`,
    `Accounting ${moduleToggles.accountingModuleEnabled ? 'On' : 'Off'}`,
    `POS ${moduleToggles.posModuleEnabled ? 'On' : 'Off'}`,
  ].join(' · ');

  return (
    <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 mb-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start justify-between gap-3 text-left"
        aria-expanded={expanded}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Briefcase className="w-5 h-5 text-[#A78BFA] shrink-0" />
            <h2 className="text-lg font-semibold text-white">Company modules</h2>
          </div>
          <p className="text-xs text-[#9CA3AF]">Admin / owner only. Changes apply to all users after sync.</p>
          {!expanded && (
            <p className="text-[11px] text-[#6B7280] mt-2 leading-snug">{summary}</p>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-[#9CA3AF] shrink-0 mt-1" />
        ) : (
          <ChevronDown className="w-5 h-5 text-[#9CA3AF] shrink-0 mt-1" />
        )}
      </button>
      {error ? <p className="text-sm text-[#FCA5A5] mt-2">{error}</p> : null}
      {expanded && (
        <>
          <div className="rounded-lg border border-[#374151] bg-[#111827] px-3 mt-3">
            <ToggleRow
              label="Enable packing"
              description="Boxes / pieces on sales and purchases"
              checked={enablePacking}
              disabled={!!savingKey}
              onChange={onPacking}
            />
            <ToggleRow
              label="Rental"
              checked={moduleToggles.rentalModuleEnabled}
              disabled={!!savingKey}
              onChange={(v) => onModule('rentals', v)}
            />
            <ToggleRow
              label="Studio"
              checked={moduleToggles.studioModuleEnabled}
              disabled={!!savingKey}
              onChange={(v) => onModule('studio', v)}
            />
            <ToggleRow
              label="Accounting"
              checked={moduleToggles.accountingModuleEnabled}
              disabled={!!savingKey}
              onChange={(v) => onModule('accounting', v)}
            />
            <ToggleRow
              label="POS"
              checked={moduleToggles.posModuleEnabled}
              disabled={!!savingKey}
              onChange={(v) => onModule('pos', v)}
            />
          </div>
          <div className="flex items-center gap-2 mt-2 text-[#6B7280]">
            <Package className="w-4 h-4" />
            <span className="text-xs">Same data as Web ERP → Settings.</span>
          </div>
        </>
      )}
    </div>
  );
}
