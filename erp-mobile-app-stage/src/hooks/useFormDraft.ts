import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearFormDraft,
  loadFormDraft,
  saveFormDraft,
} from '../lib/formDraftStore';

export interface UseFormDraftOptions<T> {
  companyId: string | null;
  ownerUserId: string;
  draftId: string;
  enabled?: boolean;
  /** Return null to skip persisting (e.g. empty form). */
  getSnapshot: () => T | null;
  applySnapshot: (data: T) => void;
  debounceMs?: number;
}

export function useFormDraft<T>({
  companyId,
  ownerUserId,
  draftId,
  enabled = true,
  getSnapshot,
  applySnapshot,
  debounceMs = 500,
}: UseFormDraftOptions<T>): {
  showRestoredBanner: boolean;
  dismissRestoredBanner: () => void;
  clearDraft: () => void;
} {
  const [showRestoredBanner, setShowRestoredBanner] = useState(false);
  const hydratedRef = useRef(false);
  const getSnapshotRef = useRef(getSnapshot);
  const applySnapshotRef = useRef(applySnapshot);
  getSnapshotRef.current = getSnapshot;
  applySnapshotRef.current = applySnapshot;

  useEffect(() => {
    if (!enabled || !companyId || !ownerUserId || hydratedRef.current) return;
    hydratedRef.current = true;
    let cancelled = false;
    void loadFormDraft(companyId, ownerUserId, draftId).then((raw) => {
      if (cancelled || raw == null) return;
      try {
        applySnapshotRef.current(raw as T);
        setShowRestoredBanner(true);
      } catch {
        /* ignore corrupt draft */
      }
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, companyId, ownerUserId, draftId]);

  useEffect(() => {
    if (!enabled || !companyId || !ownerUserId) return;
    const tick = () => {
      const snap = getSnapshotRef.current();
      if (snap == null) return;
      void saveFormDraft(companyId, ownerUserId, draftId, snap);
    };
    const id = window.setInterval(tick, debounceMs);
    return () => window.clearInterval(id);
  }, [enabled, companyId, ownerUserId, draftId, debounceMs]);

  const clearDraft = useCallback(() => {
    if (!companyId || !ownerUserId) return;
    setShowRestoredBanner(false);
    void clearFormDraft(companyId, ownerUserId, draftId);
  }, [companyId, ownerUserId, draftId]);

  const dismissRestoredBanner = useCallback(() => {
    setShowRestoredBanner(false);
  }, []);

  return { showRestoredBanner, dismissRestoredBanner, clearDraft };
}
