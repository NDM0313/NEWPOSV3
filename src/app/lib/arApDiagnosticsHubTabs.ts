export const AR_AP_DIAGNOSTICS_HUB_TABS = [
  'queues',
  'tie-out',
  'party-rental',
  'metadata',
  'journal-hygiene',
] as const;

export type ArApDiagnosticsHubTab = (typeof AR_AP_DIAGNOSTICS_HUB_TABS)[number];

export const AR_AP_HUB_TAB_PARAM = 'hubTab';

export function isArApDiagnosticsHubTab(value: string | null | undefined): value is ArApDiagnosticsHubTab {
  return Boolean(value && (AR_AP_DIAGNOSTICS_HUB_TABS as readonly string[]).includes(value));
}

export function parseArApDiagnosticsHubTabFromUrl(): ArApDiagnosticsHubTab {
  if (typeof window === 'undefined') return 'queues';
  const params = new URLSearchParams(window.location.search);
  const tab = params.get(AR_AP_HUB_TAB_PARAM);
  return isArApDiagnosticsHubTab(tab) ? tab : 'queues';
}

export function syncArApDiagnosticsHubTabToUrl(tab: ArApDiagnosticsHubTab): void {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  params.set('view', 'ar-ap-reconciliation-center');
  if (tab === 'queues') params.delete(AR_AP_HUB_TAB_PARAM);
  else params.set(AR_AP_HUB_TAB_PARAM, tab);
  const next = `/?${params.toString()}`;
  const current = `${window.location.pathname}${window.location.search}`;
  if (current !== next) window.history.replaceState({}, '', next);
}
