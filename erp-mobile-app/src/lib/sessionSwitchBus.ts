export const SESSION_SWITCH_EVENT = 'erp-mobile:session-switched';

export interface SessionSwitchDetail {
  userId: string;
  companyId: string | null;
}

export function dispatchSessionSwitched(detail: SessionSwitchDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<SessionSwitchDetail>(SESSION_SWITCH_EVENT, { detail })
  );
}

export function subscribeSessionSwitched(handler: (d: SessionSwitchDetail) => void): () => void {
  const fn = (e: Event) => {
    const ce = e as CustomEvent<SessionSwitchDetail>;
    if (ce.detail) handler(ce.detail);
  };
  window.addEventListener(SESSION_SWITCH_EVENT, fn);
  return () => window.removeEventListener(SESSION_SWITCH_EVENT, fn);
}
