/**
 * Accounting Developer Center tab slugs + URL query helpers (Phase C1).
 * Read-only routing only — no service/repair imports.
 */

export const DEVELOPER_CENTER_TAB_IDS = [
  'coa',
  'trace',
  'roznamcha',
  'statement',
  'daybook',
  'payment',
  'journal',
  'repair',
] as const;

export type DeveloperCenterTabId = (typeof DEVELOPER_CENTER_TAB_IDS)[number];

export interface PhaseCShellTabDef {
  id: DeveloperCenterTabId;
  label: string;
  phase: string;
  blurb: string;
}

/** Navigable Phase C shells (logic ships in C2–C6). */
export const PHASE_C_SHELL_TABS: PhaseCShellTabDef[] = [
  {
    id: 'roznamcha',
    label: 'Roznamcha Trace',
    phase: 'Phase C2',
    blurb: 'Roznamcha inclusion, dedupe keys, and date-range visibility.',
  },
  {
    id: 'statement',
    label: 'Statement Trace',
    phase: 'Phase C3',
    blurb: 'Party statement row inclusion rules for a contact and reference.',
  },
  {
    id: 'daybook',
    label: 'Day Book',
    phase: 'Phase C4',
    blurb: 'Unbalanced journal entries and Day Book line inclusion.',
  },
  {
    id: 'payment',
    label: 'Payment Trace',
    phase: 'Phase C5',
    blurb: 'Payment-first trace layout over linked entities.',
  },
  {
    id: 'journal',
    label: 'Journal Integrity',
    phase: 'Phase C6',
    blurb: 'Browse-only journal explorer — no void or repair actions.',
  },
];

/** Permanently disabled — not implemented in Developer Center v1. */
export const DISABLED_PLACEHOLDER_TABS = ['Opening Balance', 'Audit Log'] as const;

const TAB_SET = new Set<string>(DEVELOPER_CENTER_TAB_IDS);

export function isDeveloperCenterTabId(value: string): value is DeveloperCenterTabId {
  return TAB_SET.has(value);
}

export function parseDeveloperCenterTab(search: string): DeveloperCenterTabId {
  const raw = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get('tab');
  if (!raw || raw === 'coa') return 'coa';
  return isDeveloperCenterTabId(raw) ? raw : 'coa';
}

export function parseDeveloperCenterQuery(search: string): string {
  return new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get('q')?.trim() || '';
}

/** Tabs that accept and preserve the `q` deep-link query param. */
export function tabAcceptsQueryParam(tab: DeveloperCenterTabId): boolean {
  return tab === 'trace' || PHASE_C_SHELL_TABS.some((t) => t.id === tab);
}

export function buildDeveloperCenterSearch(tab: DeveloperCenterTabId, query?: string): string {
  const params = new URLSearchParams();
  if (tab !== 'coa') params.set('tab', tab);
  const q = query?.trim();
  if (q && tabAcceptsQueryParam(tab)) params.set('q', q);
  const s = params.toString();
  return s ? `?${s}` : '';
}

export function buildDeveloperCenterUrl(pathname: string, tab: DeveloperCenterTabId, query?: string): string {
  return `${pathname}${buildDeveloperCenterSearch(tab, query)}`;
}
