import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Palette, Type, RotateCcw, Sun, Moon, SlidersHorizontal, ChevronDown, Save } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '../ui/utils';
import { useErpTheme } from '@/app/hooks/useErpTheme';
import {
  areErpUiPreferencesEqual,
  ColorMode,
  DEFAULT_ERP_UI_PREFERENCES,
  ERP_CUSTOM_COLOR_FIELDS,
  ERP_FONT_SIZE_OPTIONS,
  ERP_THEME_PRESET_OPTIONS,
  ErpCustomColors,
  ErpFontSizeId,
  ErpUiPreferences,
  getDefaultCustomColors,
  getPresetSwatchColors,
  ThemePresetId,
} from '@/app/lib/erpThemePresets';

export interface AppearanceSettingsPanelProps {
  onDirtyChange?: (dirty: boolean) => void;
  onRegisterSave?: (save: () => void) => void;
  onRegisterRevert?: (revert: () => void) => void;
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const pickerValue = value.startsWith('#') ? value : '#2563EB';

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={pickerValue}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 rounded border border-border bg-card cursor-pointer shrink-0"
          aria-label={`${label} color picker`}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono text-xs h-9 bg-input-background text-foreground"
          spellCheck={false}
        />
      </div>
    </div>
  );
}

function PresetSwatches({ colors }: { colors: string[] }) {
  return (
    <div className="flex items-center gap-1.5 mt-3">
      {colors.map((color, i) => (
        <span
          key={`${color}-${i}`}
          className="h-4 w-4 rounded-full border border-border shrink-0"
          style={{ background: color }}
          title={color}
        />
      ))}
    </div>
  );
}

function ThemePreview({ colors }: { colors: ErpCustomColors }) {
  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{
        background: colors.background,
        borderColor: colors.border,
        color: colors.foreground,
      }}
    >
      <div
        className="px-3 py-2 text-xs font-medium border-b flex items-center justify-between gap-2"
        style={{ background: colors.sidebar, borderColor: colors.border, color: colors.foreground }}
      >
        <span>Sidebar / chrome</span>
        <span className="font-semibold" style={{ color: colors.moneyPositive }}>
          +$435.50
        </span>
      </div>
      <div
        className="px-3 py-2 text-xs font-semibold uppercase tracking-wide border-b"
        style={{ background: colors.secondary, borderColor: colors.border, color: colors.foreground }}
      >
        Table preview
      </div>
      <div className="p-2 space-y-1" style={{ background: colors.card }}>
        {['Row one', 'Row two (hover)'].map((label, i) => (
          <div
            key={label}
            className="px-3 py-2 rounded text-sm border flex items-center justify-between"
            style={{
              borderColor: colors.border,
              background: i === 1 ? colors.rowHover : 'transparent',
              color: colors.foreground,
            }}
          >
            <span>{label}</span>
            {i === 1 ? (
              <span className="font-semibold tabular-nums" style={{ color: colors.moneyNegative }}>
                -$100.50
              </span>
            ) : (
              <span className="font-semibold tabular-nums" style={{ color: colors.moneyPositive }}>
                $9914.25
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AppearanceSettingsPanel({
  onDirtyChange,
  onRegisterSave,
  onRegisterRevert,
}: AppearanceSettingsPanelProps) {
  const { preferences, previewPreferences, commitPreferences } = useErpTheme();
  const [draft, setDraft] = useState<ErpUiPreferences>(preferences);
  const [editingCustom, setEditingCustom] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    setDraft(preferences);
  }, [preferences]);

  useEffect(() => {
    previewPreferences(draft);
  }, [draft, previewPreferences]);

  const isDirty = useMemo(
    () => !areErpUiPreferencesEqual(draft, preferences),
    [draft, preferences],
  );

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleSave = useCallback(() => {
    commitPreferences(draft);
  }, [commitPreferences, draft]);

  const revertToSaved = useCallback(() => {
    const saved = preferencesRef.current;
    setDraft(saved);
    previewPreferences(saved);
    setEditingCustom(false);
    setAdvancedOpen(false);
  }, [previewPreferences]);

  useEffect(() => {
    onRegisterSave?.(handleSave);
  }, [handleSave, onRegisterSave]);

  useEffect(() => {
    onRegisterRevert?.(revertToSaved);
  }, [revertToSaved, onRegisterRevert]);

  useEffect(() => {
    return () => {
      if (!areErpUiPreferencesEqual(draftRef.current, preferencesRef.current)) {
        previewPreferences(preferencesRef.current);
      }
    };
  }, [previewPreferences]);

  const activeColors = useMemo((): ErpCustomColors => {
    if (draft.preset === 'custom' && draft.customColors) {
      return draft.customColors;
    }
    return getDefaultCustomColors(draft.colorMode);
  }, [draft.colorMode, draft.preset, draft.customColors]);

  const surfaceFields = ERP_CUSTOM_COLOR_FIELDS.filter((f) => f.group === 'surface');
  const advancedFields = ERP_CUSTOM_COLOR_FIELDS.filter((f) => f.group === 'advanced');

  const setDraftColorMode = (colorMode: ColorMode) => {
    setDraft((prev) => {
      const next: ErpUiPreferences = {
        ...prev,
        colorMode,
        customColors:
          prev.preset === 'custom' ? getDefaultCustomColors(colorMode) : prev.customColors,
      };
      if (prev.preset === 'custom' && !prev.customColors) {
        next.customColors = getDefaultCustomColors(colorMode);
      }
      return next;
    });
  };

  const setDraftPreset = (preset: ThemePresetId) => {
    setDraft((prev) => ({
      ...prev,
      preset,
      customColors: preset === 'custom' ? getDefaultCustomColors(prev.colorMode) : undefined,
    }));
  };

  const setDraftFontSize = (fontSize: ErpFontSizeId) => {
    setDraft((prev) => ({ ...prev, fontSize }));
  };

  const handleCustomColorChange = (key: keyof ErpCustomColors, value: string) => {
    setDraft((prev) => {
      const base =
        prev.preset === 'custom' && prev.customColors
          ? prev.customColors
          : getDefaultCustomColors(prev.colorMode);
      return {
        ...prev,
        preset: 'custom' as const,
        customColors: { ...base, [key]: value },
      };
    });
    setAdvancedOpen(true);
  };

  const startCustomizing = () => {
    setDraft((prev) => ({
      ...prev,
      preset: 'custom',
      customColors: getDefaultCustomColors(prev.colorMode),
    }));
    setEditingCustom(true);
    setAdvancedOpen(false);
  };

  const usePresetColors = () => {
    setDraft((prev) => ({ ...prev, preset: 'default', customColors: undefined }));
    setEditingCustom(false);
    setAdvancedOpen(false);
  };

  const handlePresetSelect = (id: typeof ERP_THEME_PRESET_OPTIONS[number]['id']) => {
    setDraftPreset(id);
    setEditingCustom(false);
    setAdvancedOpen(false);
  };

  const handleReset = () => {
    commitPreferences(DEFAULT_ERP_UI_PREFERENCES);
    setDraft(DEFAULT_ERP_UI_PREFERENCES);
    setEditingCustom(false);
    setAdvancedOpen(false);
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <Palette size={20} className="text-primary" />
          Appearance
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Light/dark mode, presets, and custom colors apply across the web ERP after you save. Stored per
          user in this browser.
        </p>
        {isDirty ? (
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            You have unsaved appearance changes.
          </p>
        ) : null}
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">Color mode</h3>
        <div className="inline-flex rounded-lg border border-border p-1 bg-muted/30">
          <button
            type="button"
            onClick={() => setDraftColorMode('light')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
              draft.colorMode === 'light'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Sun size={16} />
            Light
          </button>
          <button
            type="button"
            onClick={() => setDraftColorMode('dark')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
              draft.colorMode === 'dark'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Moon size={16} />
            Dark
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">Theme preset</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {ERP_THEME_PRESET_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => handlePresetSelect(opt.id)}
              className={cn(
                'text-left rounded-xl border p-4 transition-colors',
                draft.preset === opt.id
                  ? 'border-primary bg-primary/10 ring-1 ring-primary/40'
                  : 'border-border bg-card hover:bg-accent/40',
              )}
            >
              <div className="font-medium text-foreground text-sm">{opt.label}</div>
              <p className="text-xs text-muted-foreground mt-1 leading-snug">{opt.description}</p>
              <PresetSwatches colors={getPresetSwatchColors(draft.colorMode, opt.id)} />
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
            <SlidersHorizontal size={16} />
            Customize colors
          </h3>
          <div className="flex items-center gap-2">
            {draft.preset === 'custom' && !editingCustom ? (
              <Button type="button" variant="outline" size="sm" onClick={usePresetColors}>
                Use preset colors
              </Button>
            ) : null}
            {!editingCustom ? (
              <Button type="button" variant="outline" size="sm" onClick={startCustomizing}>
                Edit colors
              </Button>
            ) : null}
          </div>
        </div>

        {draft.preset === 'custom' && !editingCustom ? (
          <p className="text-xs text-muted-foreground rounded-lg border border-border bg-muted/30 px-3 py-2">
            Custom theme active — click Edit colors to change, or Use preset colors to return to the Default
            preset.
          </p>
        ) : null}

        {editingCustom ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              {surfaceFields.map((field) => (
                <ColorField
                  key={field.key}
                  label={field.label}
                  value={activeColors[field.key]}
                  onChange={(v) => handleCustomColorChange(field.key, v)}
                />
              ))}
            </div>

            <div className="rounded-xl border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => setAdvancedOpen((o) => !o)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-accent/40 transition-colors"
              >
                Advanced colors
                <ChevronDown size={16} className={cn('transition-transform', advancedOpen && 'rotate-180')} />
              </button>
              {advancedOpen ? (
                <div className="grid gap-4 sm:grid-cols-2 p-4 pt-0 border-t border-border">
                  {advancedFields.map((field) => (
                    <ColorField
                      key={field.key}
                      label={field.label}
                      value={activeColors[field.key]}
                      onChange={(v) => handleCustomColorChange(field.key, v)}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Pick a preset above or click Edit colors to override surfaces, row hover, money digits, and chrome.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">Live preview</h3>
        <ThemePreview colors={activeColors} />
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Type size={16} />
          Font size
        </h3>
        <div className="flex flex-wrap gap-2">
          {ERP_FONT_SIZE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setDraftFontSize(opt.id)}
              className={cn(
                'px-4 py-2 rounded-lg border text-sm font-medium transition-colors',
                draft.fontSize === opt.id
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent/40',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      <div className="pt-2 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          className="gap-2 bg-green-600 hover:bg-green-500 text-foreground shadow-lg"
          onClick={handleSave}
          disabled={!isDirty}
        >
          <Save size={16} />
          Save appearance
        </Button>
        <Button type="button" variant="outline" className="gap-2" onClick={handleReset}>
          <RotateCcw size={16} />
          Reset to default
        </Button>
      </div>
    </div>
  );
}
