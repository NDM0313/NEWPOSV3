import { useCallback, useEffect, useRef, useState } from 'react';
import type { Branch } from '../api/branches';
import { dispatchMobileInvalidated } from '../lib/dataInvalidationBus';
import { useWriteBranchSelection } from './useWriteBranchSelection';
import { resolveWriteBranchFromList } from '../utils/writeBranchResolution';

export type DocumentBranchGateDomain = 'sales' | 'purchases' | 'contacts' | 'inventory';

export interface UseDocumentBranchGateOptions {
  companyId: string | null | undefined;
  globalBranchId: string | null | undefined;
  userRole?: string;
  authUserId?: string | null;
  profileId?: string | null;
  /** Domains to invalidate after branch is confirmed. */
  invalidateDomains?: DocumentBranchGateDomain[];
}

function prefetchBranchData(companyId: string, branchId: string): void {
  void Promise.all([
    import('../api/contacts').then((m) => m.getContacts(companyId, undefined, branchId)),
    import('../api/contacts').then((m) => m.getContacts(companyId, 'customer', branchId)),
    import('../api/contacts').then((m) => m.getContacts(companyId, 'supplier', branchId)),
    import('../api/products').then((m) => m.getProducts(companyId, { branchId })),
  ]).catch(() => {});
}

function invalidateForBranch(
  companyId: string,
  branchId: string,
  domains: DocumentBranchGateDomain[],
): void {
  const domainMap: Record<DocumentBranchGateDomain, 'sales' | 'purchases' | 'contacts'> = {
    sales: 'sales',
    purchases: 'purchases',
    contacts: 'contacts',
    inventory: 'contacts',
  };
  const seen = new Set<string>();
  for (const d of domains) {
    const mapped = domainMap[d];
    if (seen.has(mapped)) continue;
    seen.add(mapped);
    dispatchMobileInvalidated({
      domain: mapped,
      companyId,
      branchId,
      reason: 'document-branch-pick',
    });
  }
}

export function useDocumentBranchGate({
  companyId,
  globalBranchId,
  userRole,
  authUserId,
  profileId,
  invalidateDomains = ['contacts', 'sales'],
}: UseDocumentBranchGateOptions) {
  const pendingCallbackRef = useRef<((branchId: string) => void) | null>(null);
  const pendingTitleRef = useRef('Select branch');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalBranches, setModalBranches] = useState<Branch[]>([]);
  const [modalTitle, setModalTitle] = useState('Select branch');
  const [gateError, setGateError] = useState<string | null>(null);

  const { accessibleBranches, loading, error: loadError } = useWriteBranchSelection({
    companyId,
    globalBranchId,
    userRole,
    authUserId,
    profileId,
  });

  const applyResolution = useCallback(
    (onReady: (branchId: string) => void, title: string) => {
      if (!companyId) return;
      const resolution = resolveWriteBranchFromList(globalBranchId, accessibleBranches, undefined);
      if (resolution.status === 'resolved') {
        setGateError(null);
        invalidateForBranch(companyId, resolution.branchId, invalidateDomains);
        prefetchBranchData(companyId, resolution.branchId);
        onReady(resolution.branchId);
        return;
      }
      if (resolution.status === 'error') {
        setGateError(resolution.message);
        return;
      }
      setGateError(null);
      pendingCallbackRef.current = onReady;
      setModalTitle(title);
      setModalBranches(resolution.branches);
      setModalOpen(true);
    },
    [companyId, globalBranchId, accessibleBranches, invalidateDomains],
  );

  useEffect(() => {
    if (loading || !pendingCallbackRef.current) return;
    const cb = pendingCallbackRef.current;
    pendingCallbackRef.current = null;
    applyResolution(cb, pendingTitleRef.current);
  }, [loading, accessibleBranches, applyResolution]);

  const confirmBranch = useCallback(
    (branchId: string) => {
      if (!companyId) return;
      setModalOpen(false);
      setGateError(null);
      invalidateForBranch(companyId, branchId, invalidateDomains);
      prefetchBranchData(companyId, branchId);
      const cb = pendingCallbackRef.current;
      pendingCallbackRef.current = null;
      cb?.(branchId);
    },
    [companyId, invalidateDomains],
  );

  const runWithBranch = useCallback(
    (onReady: (branchId: string) => void, options?: { title?: string }) => {
      if (!companyId) return;
      const title = options?.title ?? 'Select branch';
      pendingTitleRef.current = title;
      setGateError(null);
      if (loading) {
        pendingCallbackRef.current = onReady;
        return;
      }
      if (loadError) {
        setGateError(loadError);
        return;
      }
      applyResolution(onReady, title);
    },
    [companyId, loading, loadError, applyResolution],
  );

  const cancelModal = useCallback(() => {
    setModalOpen(false);
    pendingCallbackRef.current = null;
  }, []);

  return {
    runWithBranch,
    loading,
    loadError: loadError ?? gateError,
    modalProps: {
      open: modalOpen,
      title: modalTitle,
      branches: modalBranches,
      onPick: confirmBranch,
      onCancel: cancelModal,
    },
  };
}
