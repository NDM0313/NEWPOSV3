export type ColorMode = 'light' | 'dark';
export type ThemePresetId = 'default' | 'highContrast' | 'compact' | 'custom';
export type ErpFontSizeId = 'sm' | 'base' | 'lg';

/** @deprecated Use ThemePresetId */
export type ErpThemePresetId = ThemePresetId;

export interface ErpCustomColors {
  background: string;
  foreground: string;
  card: string;
  secondary: string;
  accent: string;
  border: string;
  rowHover: string;
  sidebar: string;
  moneyPositive: string;
  moneyNegative: string;
  overlay: string;
}

export interface ErpUiPreferences {
  colorMode: ColorMode;
  preset: ThemePresetId;
  fontSize: ErpFontSizeId;
  customColors?: ErpCustomColors;
}

export const DEFAULT_ERP_UI_PREFERENCES: ErpUiPreferences = {
  colorMode: 'dark',
  preset: 'default',
  fontSize: 'base',
};

const STORAGE_PREFIX = 'erp-ui-preferences';

export function erpUiPreferencesKey(userId: string | null | undefined): string {
  return `${STORAGE_PREFIX}:${userId || 'anonymous'}`;
}

type ShadcnThemeVars = {
  '--background': string;
  '--foreground': string;
  '--card': string;
  '--card-foreground': string;
  '--secondary': string;
  '--muted': string;
  '--muted-foreground': string;
  '--border': string;
  '--accent': string;
  '--accent-foreground': string;
  '--erp-row-hover': string;
  '--sidebar': string;
  '--sidebar-foreground': string;
  '--sidebar-border': string;
  '--sidebar-accent': string;
  '--sidebar-accent-foreground': string;
  '--popover': string;
  '--popover-foreground': string;
  '--input-background': string;
  '--input': string;
  '--erp-money-positive': string;
  '--erp-money-negative': string;
  '--erp-overlay': string;
  '--font-size'?: string;
  '--erp-row-padding'?: string;
};

type PresetBase = Omit<
  ShadcnThemeVars,
  | '--sidebar'
  | '--sidebar-foreground'
  | '--sidebar-border'
  | '--sidebar-accent'
  | '--sidebar-accent-foreground'
  | '--popover'
  | '--popover-foreground'
  | '--input-background'
  | '--input'
  | '--erp-money-positive'
  | '--erp-money-negative'
  | '--erp-overlay'
>;

const LIGHT_CHROME: Pick<
  ShadcnThemeVars,
  | '--sidebar'
  | '--sidebar-foreground'
  | '--sidebar-border'
  | '--sidebar-accent'
  | '--sidebar-accent-foreground'
  | '--popover'
  | '--popover-foreground'
  | '--input-background'
  | '--input'
  | '--erp-money-positive'
  | '--erp-money-negative'
  | '--erp-overlay'
> = {
  '--sidebar': '#F1F5F9',
  '--sidebar-foreground': '#0F172A',
  '--sidebar-border': '#E2E8F0',
  '--sidebar-accent': 'rgba(37, 99, 235, 0.08)',
  '--sidebar-accent-foreground': '#0F172A',
  '--popover': '#FFFFFF',
  '--popover-foreground': '#0F172A',
  '--input-background': '#FFFFFF',
  '--input': '#E2E8F0',
  '--erp-money-positive': '#059669',
  '--erp-money-negative': '#DC2626',
  '--erp-overlay': 'rgba(15, 23, 42, 0.45)',
};

const DARK_CHROME: Pick<
  ShadcnThemeVars,
  | '--sidebar'
  | '--sidebar-foreground'
  | '--sidebar-border'
  | '--sidebar-accent'
  | '--sidebar-accent-foreground'
  | '--popover'
  | '--popover-foreground'
  | '--input-background'
  | '--input'
  | '--erp-money-positive'
  | '--erp-money-negative'
  | '--erp-overlay'
> = {
  '--sidebar': '#111827',
  '--sidebar-foreground': '#FFFFFF',
  '--sidebar-border': 'rgba(255, 255, 255, 0.1)',
  '--sidebar-accent': 'rgba(255, 255, 255, 0.05)',
  '--sidebar-accent-foreground': '#FFFFFF',
  '--popover': '#0B1019',
  '--popover-foreground': '#FFFFFF',
  '--input-background': '#0B1019',
  '--input': 'rgba(255, 255, 255, 0.05)',
  '--erp-money-positive': '#4ADE80',
  '--erp-money-negative': '#F87171',
  '--erp-overlay': 'rgba(0, 0, 0, 0.5)',
};

function withChrome(colorMode: ColorMode, base: PresetBase): ShadcnThemeVars {
  return { ...base, ...(colorMode === 'light' ? LIGHT_CHROME : DARK_CHROME) };
}

/** Maps erp-design-system.css palette → shadcn CSS variables */
export function erpDesignTokensToShadcnVars(
  colorMode: ColorMode,
  preset: Exclude<ThemePresetId, 'custom'>,
): ShadcnThemeVars {
  const lightBases: Record<Exclude<ThemePresetId, 'custom'>, PresetBase> = {
    default: {
      '--background': '#F8FAFC',
      '--foreground': '#0F172A',
      '--card': '#FFFFFF',
      '--card-foreground': '#0F172A',
      '--secondary': '#F1F5F9',
      '--muted': '#E2E8F0',
      '--muted-foreground': '#64748B',
      '--border': '#E2E8F0',
      '--accent': 'rgba(37, 99, 235, 0.08)',
      '--accent-foreground': '#0F172A',
      '--erp-row-hover': 'color-mix(in srgb, #2563EB 12%, transparent)',
    },
    highContrast: {
      '--background': '#FFFFFF',
      '--foreground': '#020617',
      '--card': '#F8FAFC',
      '--card-foreground': '#020617',
      '--secondary': '#E2E8F0',
      '--muted': '#CBD5E1',
      '--muted-foreground': '#334155',
      '--border': '#94A3B8',
      '--accent': 'rgba(37, 99, 235, 0.14)',
      '--accent-foreground': '#020617',
      '--erp-row-hover': 'color-mix(in srgb, #2563EB 18%, transparent)',
    },
    compact: {
      '--background': '#F8FAFC',
      '--foreground': '#0F172A',
      '--card': '#FFFFFF',
      '--card-foreground': '#0F172A',
      '--secondary': '#F1F5F9',
      '--muted': '#E2E8F0',
      '--muted-foreground': '#64748B',
      '--border': '#E2E8F0',
      '--accent': 'rgba(37, 99, 235, 0.08)',
      '--accent-foreground': '#0F172A',
      '--erp-row-hover': 'color-mix(in srgb, #2563EB 12%, transparent)',
      '--font-size': '14px',
      '--erp-row-padding': '3rem',
    },
  };

  const darkBases: Record<Exclude<ThemePresetId, 'custom'>, PresetBase> = {
    default: {
      '--background': '#111827',
      '--foreground': '#FFFFFF',
      '--card': '#1F2937',
      '--card-foreground': '#FFFFFF',
      '--secondary': '#0B1019',
      '--muted': '#1F2937',
      '--muted-foreground': '#9CA3AF',
      '--border': 'rgba(255, 255, 255, 0.1)',
      '--accent': 'rgba(255, 255, 255, 0.05)',
      '--accent-foreground': '#FFFFFF',
      '--erp-row-hover': 'color-mix(in srgb, rgba(255, 255, 255, 0.05) 45%, transparent)',
    },
    highContrast: {
      '--background': '#0a0e17',
      '--foreground': '#ffffff',
      '--card': '#1a2332',
      '--card-foreground': '#ffffff',
      '--secondary': '#0d121c',
      '--muted': '#2a3548',
      '--muted-foreground': '#cbd5e1',
      '--border': 'rgba(255, 255, 255, 0.18)',
      '--accent': 'rgba(59, 130, 246, 0.15)',
      '--accent-foreground': '#ffffff',
      '--erp-row-hover': 'color-mix(in srgb, rgba(59, 130, 246, 0.15) 55%, transparent)',
    },
    compact: {
      '--background': '#111827',
      '--foreground': '#FFFFFF',
      '--card': '#1F2937',
      '--card-foreground': '#FFFFFF',
      '--secondary': '#0B1019',
      '--muted': '#1F2937',
      '--muted-foreground': '#9CA3AF',
      '--border': 'rgba(255, 255, 255, 0.1)',
      '--accent': 'rgba(255, 255, 255, 0.05)',
      '--accent-foreground': '#FFFFFF',
      '--erp-row-hover': 'color-mix(in srgb, rgba(255, 255, 255, 0.05) 45%, transparent)',
      '--font-size': '14px',
      '--erp-row-padding': '3rem',
    },
  };

  const base = colorMode === 'light' ? lightBases[preset] : darkBases[preset];
  return withChrome(colorMode, base);
}

export function getPresetSwatchColors(
  colorMode: ColorMode,
  preset: Exclude<ThemePresetId, 'custom'>,
): string[] {
  const vars = erpDesignTokensToShadcnVars(colorMode, preset);
  return [
    vars['--background'],
    vars['--card'],
    vars['--sidebar'],
    vars['--accent'],
    vars['--erp-row-hover'],
  ];
}

function customColorsToVars(colors: ErpCustomColors): ShadcnThemeVars {
  return {
    '--background': colors.background,
    '--foreground': colors.foreground,
    '--card': colors.card,
    '--card-foreground': colors.foreground,
    '--secondary': colors.secondary,
    '--muted': colors.secondary,
    '--muted-foreground': colors.foreground,
    '--border': colors.border,
    '--accent': colors.accent,
    '--accent-foreground': colors.foreground,
    '--erp-row-hover': colors.rowHover,
    '--sidebar': colors.sidebar,
    '--sidebar-foreground': colors.foreground,
    '--sidebar-border': colors.border,
    '--sidebar-accent': colors.accent,
    '--sidebar-accent-foreground': colors.foreground,
    '--popover': colors.card,
    '--popover-foreground': colors.foreground,
    '--input-background': colors.card,
    '--input': colors.border,
    '--erp-money-positive': colors.moneyPositive,
    '--erp-money-negative': colors.moneyNegative,
    '--erp-overlay': colors.overlay,
  };
}

export function getDefaultCustomColors(colorMode: ColorMode): ErpCustomColors {
  const vars = erpDesignTokensToShadcnVars(colorMode, 'default');
  return {
    background: vars['--background'],
    foreground: vars['--foreground'],
    card: vars['--card'],
    secondary: vars['--secondary'],
    accent: vars['--accent'],
    border: vars['--border'],
    rowHover: vars['--erp-row-hover'],
    sidebar: vars['--sidebar'],
    moneyPositive: vars['--erp-money-positive'],
    moneyNegative: vars['--erp-money-negative'],
    overlay: vars['--erp-overlay'],
  };
}

function normalizeCustomColors(
  partial: Partial<ErpCustomColors> | undefined,
  colorMode: ColorMode,
): ErpCustomColors | undefined {
  if (!partial) return undefined;
  const defaults = getDefaultCustomColors(colorMode);
  return { ...defaults, ...partial };
}

function migrateLegacyPreferences(parsed: Record<string, unknown>): ErpUiPreferences {
  const fontSize =
    parsed.fontSize === 'sm' || parsed.fontSize === 'lg' ? parsed.fontSize : 'base';

  if (parsed.colorMode === 'light' || parsed.colorMode === 'dark') {
    const colorMode = parsed.colorMode;
    const preset =
      parsed.preset === 'highContrast' || parsed.preset === 'compact' || parsed.preset === 'custom'
        ? parsed.preset
        : 'default';
    const customColors =
      preset === 'custom' && parsed.customColors && typeof parsed.customColors === 'object'
        ? normalizeCustomColors(parsed.customColors as Partial<ErpCustomColors>, colorMode)
        : undefined;
    return { colorMode, preset, fontSize, customColors };
  }

  const legacyPreset = parsed.preset as string | undefined;
  let colorMode: ColorMode = 'dark';
  let preset: ThemePresetId = 'default';

  if (legacyPreset === 'highContrast') {
    preset = 'highContrast';
  } else if (legacyPreset === 'compact') {
    preset = 'compact';
  }

  return { colorMode, preset, fontSize };
}

export function loadErpUiPreferences(userId: string | null | undefined): ErpUiPreferences {
  if (typeof window === 'undefined') return DEFAULT_ERP_UI_PREFERENCES;
  try {
    const raw = localStorage.getItem(erpUiPreferencesKey(userId));
    if (!raw) return DEFAULT_ERP_UI_PREFERENCES;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return migrateLegacyPreferences(parsed);
  } catch {
    return DEFAULT_ERP_UI_PREFERENCES;
  }
}

export function saveErpUiPreferences(userId: string | null | undefined, prefs: ErpUiPreferences): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(erpUiPreferencesKey(userId), JSON.stringify(prefs));
}

const CUSTOM_COLOR_KEYS: Array<keyof ErpCustomColors> = [
  'background',
  'foreground',
  'card',
  'secondary',
  'accent',
  'border',
  'rowHover',
  'sidebar',
  'moneyPositive',
  'moneyNegative',
  'overlay',
];

function customColorsEqual(
  a: ErpCustomColors | undefined,
  b: ErpCustomColors | undefined,
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return CUSTOM_COLOR_KEYS.every((key) => a[key] === b[key]);
}

export function areErpUiPreferencesEqual(a: ErpUiPreferences, b: ErpUiPreferences): boolean {
  if (a.colorMode !== b.colorMode || a.preset !== b.preset || a.fontSize !== b.fontSize) {
    return false;
  }
  if (a.preset === 'custom' || b.preset === 'custom') {
    return customColorsEqual(a.customColors, b.customColors);
  }
  return true;
}

const FONT_SIZE_VARS: Record<ErpFontSizeId, string> = {
  sm: '14px',
  base: '16px',
  lg: '18px',
};

const MANAGED_KEYS = [
  '--background',
  '--foreground',
  '--card',
  '--card-foreground',
  '--secondary',
  '--muted',
  '--muted-foreground',
  '--border',
  '--accent',
  '--accent-foreground',
  '--erp-row-hover',
  '--sidebar',
  '--sidebar-foreground',
  '--sidebar-border',
  '--sidebar-accent',
  '--sidebar-accent-foreground',
  '--popover',
  '--popover-foreground',
  '--input-background',
  '--input',
  '--erp-money-positive',
  '--erp-money-negative',
  '--erp-overlay',
  '--font-size',
  '--erp-row-padding',
] as const;

export function applyErpTheme(prefs: ErpUiPreferences): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  root.classList.toggle('dark', prefs.colorMode === 'dark');

  MANAGED_KEYS.forEach((key) => root.style.removeProperty(key));

  let themeVars: ShadcnThemeVars;
  if (prefs.preset === 'custom' && prefs.customColors) {
    themeVars = customColorsToVars(
      normalizeCustomColors(prefs.customColors, prefs.colorMode) ?? getDefaultCustomColors(prefs.colorMode),
    );
  } else {
    themeVars = erpDesignTokensToShadcnVars(
      prefs.colorMode,
      prefs.preset === 'custom' ? 'default' : prefs.preset,
    );
  }

  Object.entries(themeVars).forEach(([key, value]) => {
    if (value) root.style.setProperty(key, value);
  });

  if (!themeVars['--font-size']) {
    root.style.setProperty('--font-size', FONT_SIZE_VARS[prefs.fontSize]);
  }
  if (!themeVars['--erp-row-padding'] && prefs.preset !== 'compact') {
    root.style.setProperty('--erp-row-padding', '4rem');
  }

  root.dataset.erpColorMode = prefs.colorMode;
  root.dataset.erpPreset = prefs.preset;
  root.dataset.erpFontSize = prefs.fontSize;
}

export const ERP_THEME_PRESET_OPTIONS: Array<{
  id: Exclude<ThemePresetId, 'custom'>;
  label: string;
  description: string;
}> = [
  { id: 'default', label: 'Default', description: 'Balanced contrast from the design system' },
  { id: 'highContrast', label: 'High Contrast', description: 'Stronger borders and text for readability' },
  { id: 'compact', label: 'Compact', description: 'Smaller type and tighter table rows' },
];

export const ERP_FONT_SIZE_OPTIONS: Array<{ id: ErpFontSizeId; label: string }> = [
  { id: 'sm', label: 'Small' },
  { id: 'base', label: 'Default' },
  { id: 'lg', label: 'Large' },
];

export const ERP_CUSTOM_COLOR_FIELDS: Array<{ key: keyof ErpCustomColors; label: string; group: 'surface' | 'advanced' }> = [
  { key: 'background', label: 'Page background', group: 'surface' },
  { key: 'secondary', label: 'Panel / page body', group: 'surface' },
  { key: 'card', label: 'Card / table surface', group: 'surface' },
  { key: 'foreground', label: 'Text', group: 'surface' },
  { key: 'accent', label: 'Accent', group: 'surface' },
  { key: 'border', label: 'Border', group: 'surface' },
  { key: 'rowHover', label: 'Row hover', group: 'advanced' },
  { key: 'sidebar', label: 'Sidebar / chrome', group: 'advanced' },
  { key: 'moneyPositive', label: 'Money positive', group: 'advanced' },
  { key: 'moneyNegative', label: 'Money negative', group: 'advanced' },
  { key: 'overlay', label: 'Overlay / backdrop', group: 'advanced' },
];
