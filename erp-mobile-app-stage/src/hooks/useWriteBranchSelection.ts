import { useEffect, useMemo, useState } from 'react';
import { getBranches, type Branch } from '../api/branches';
import { getUserAccessibleBranchIds, getUserAssignedBranchIds, canPickAllCompanyBranches } from '../api/permissions';
import {
  filterAccessibleBranches,
  isBranchSentinel,
  pickEffectiveWriteBranchId,
  resolveWriteBranchFromList,
  shouldShowWriteBranchPicker,
} from '../utils/writeBranchResolution';

export interface UseWriteBranchSelectionOptions {
  companyId: string | null | undefined;
  globalBranchId: string | null | undefined;
  /** When paying/editing an existing document, its branch_id takes priority. */
  documentBranchId?: string | null;
  userRole?: string;
  /** auth.users.id */
  authUserId?: string | null;
  profileId?: string | null;
}

export function useWriteBranchSelection({
  companyId,
  globalBranchId,
  documentBranchId,
  userRole,
  authUserId,
  profileId,
}: UseWriteBranchSelectionOptions) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [userBranchIds, setUserBranchIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pickedBranchId, setPickedBranchId] = useState('');

  const unrestricted = canPickAllCompanyBranches(userRole);

  useEffect(() => {
    if (!companyId) {
      setBranches([]);
      setUserBranchIds([]);
      setLoadError(null);
      setPickedBranchId('');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    Promise.all([
      getBranches(companyId),
      authUserId || profileId
        ? unrestricted
          ? getUserAccessibleBranchIds(authUserId, profileId, companyId)
          : getUserAssignedBranchIds(authUserId ?? '', profileId ?? authUserId ?? '').then((r) => r.branchIds)
        : Promise.resolve([] as string[]),
    ]).then(([branchRes, ubIds]) => {
      if (cancelled) return;
      setLoading(false);
      if (branchRes.error) {
        setLoadError(branchRes.error);
        setBranches([]);
        return;
      }
      setBranches(branchRes.data ?? []);
      setUserBranchIds(ubIds);
    });

    return () => {
      cancelled = true;
    };
  }, [companyId, authUserId, profileId, unrestricted]);

  const accessibleBranches = useMemo(
    () => filterAccessibleBranches(branches, userBranchIds, unrestricted),
    [branches, userBranchIds, unrestricted],
  );

  const resolution = useMemo(
    () => resolveWriteBranchFromList(globalBranchId, accessibleBranches, documentBranchId),
    [globalBranchId, accessibleBranches, documentBranchId],
  );

  useEffect(() => {
    if (isBranchSentinel(globalBranchId)) {
      setPickedBranchId('');
    }
  }, [globalBranchId]);

  useEffect(() => {
    if (resolution.status === 'pick' && resolution.suggestedId && !pickedBranchId) {
      setPickedBranchId(resolution.suggestedId);
    }
  }, [resolution, pickedBranchId]);

  const needsPicker = shouldShowWriteBranchPicker(resolution);

  const effectiveBranchId =
    resolution.status === 'resolved'
      ? resolution.branchId
      : pickEffectiveWriteBranchId(globalBranchId, pickedBranchId, documentBranchId);

  const error =
    loadError ??
    (resolution.status === 'error' ? resolution.message : null);

  const ready = !loading && !error && (needsPicker ? !!effectiveBranchId : resolution.status === 'resolved');

  return {
    effectiveBranchId,
    needsPicker,
    pickerBranches: resolution.status === 'pick' ? resolution.branches : accessibleBranches,
    pickedBranchId,
    setPickedBranchId,
    loading,
    ready,
    error,
    accessibleBranches,
  };
}
