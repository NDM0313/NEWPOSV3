import { useCallback, useEffect, useState } from 'react';
import { useSupabase } from '@/app/context/SupabaseContext';
import {
  applyErpTheme,
  ColorMode,
  DEFAULT_ERP_UI_PREFERENCES,
  ErpCustomColors,
  ErpFontSizeId,
  ErpUiPreferences,
  getDefaultCustomColors,
  loadErpUiPreferences,
  saveErpUiPreferences,
  ThemePresetId,
} from '@/app/lib/erpThemePresets';

export function useErpTheme() {
  const { user } = useSupabase();
  const userId = user?.id ?? null;
  const [preferences, setPreferences] = useState<ErpUiPreferences>(DEFAULT_ERP_UI_PREFERENCES);

  useEffect(() => {
    const loaded = loadErpUiPreferences(userId);
    setPreferences(loaded);
    applyErpTheme(loaded);
  }, [userId]);

  const updatePreferences = useCallback(
    (patch: Partial<ErpUiPreferences>) => {
      setPreferences((prev) => {
        const next: ErpUiPreferences = {
          colorMode: patch.colorMode ?? prev.colorMode,
          preset: patch.preset ?? prev.preset,
          fontSize: patch.fontSize ?? prev.fontSize,
          customColors: patch.customColors !== undefined ? patch.customColors : prev.customColors,
        };
        saveErpUiPreferences(userId, next);
        applyErpTheme(next);
        return next;
      });
    },
    [userId],
  );

  const setColorMode = useCallback(
    (colorMode: ColorMode) => {
      setPreferences((prev) => {
        const next: ErpUiPreferences = {
          ...prev,
          colorMode,
          customColors:
            prev.preset === 'custom'
              ? getDefaultCustomColors(colorMode)
              : prev.customColors,
        };
        if (prev.preset === 'custom' && !prev.customColors) {
          next.customColors = getDefaultCustomColors(colorMode);
        }
        saveErpUiPreferences(userId, next);
        applyErpTheme(next);
        return next;
      });
    },
    [userId],
  );

  const setPreset = useCallback(
    (preset: ThemePresetId) => {
      updatePreferences({
        preset,
        customColors:
          preset === 'custom' ? getDefaultCustomColors(preferences.colorMode) : undefined,
      });
    },
    [updatePreferences, preferences.colorMode],
  );

  const setCustomColors = useCallback(
    (customColors: ErpCustomColors) => {
      updatePreferences({ preset: 'custom', customColors });
    },
    [updatePreferences],
  );

  const setFontSize = useCallback(
    (fontSize: ErpFontSizeId) => updatePreferences({ fontSize }),
    [updatePreferences],
  );

  const resetToDefault = useCallback(() => {
    saveErpUiPreferences(userId, DEFAULT_ERP_UI_PREFERENCES);
    setPreferences(DEFAULT_ERP_UI_PREFERENCES);
    applyErpTheme(DEFAULT_ERP_UI_PREFERENCES);
  }, [userId]);

  const previewPreferences = useCallback((prefs: ErpUiPreferences) => {
    applyErpTheme(prefs);
  }, []);

  const commitPreferences = useCallback(
    (prefs: ErpUiPreferences) => {
      saveErpUiPreferences(userId, prefs);
      setPreferences(prefs);
      applyErpTheme(prefs);
    },
    [userId],
  );

  return {
    preferences,
    setColorMode,
    setPreset,
    setCustomColors,
    setFontSize,
    updatePreferences,
    resetToDefault,
    previewPreferences,
    commitPreferences,
  };
}
