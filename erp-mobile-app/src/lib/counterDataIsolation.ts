/** Client-side row scoping when counter worker is active under Admin JWT. */



import {

  resolveModuleListBranchScope,

  type ListBranchScope,

} from './listBranchScope';



export type { ListBranchScope };



export function resolveCounterListBranchScope(

  selectedBranchId: string | null | undefined,

  accessibleBranchIds: string[],

  isAdminOrOwner: boolean,

  isolateWorkerData?: boolean,

): ListBranchScope {

  return resolveModuleListBranchScope(

    selectedBranchId,

    accessibleBranchIds,

    isAdminOrOwner,

    isolateWorkerData,

  );

}



export function shouldIsolateCounterWorkerData(role: string): boolean {

  const r = (role || '').toLowerCase();

  return r === 'worker' || r === 'salesman';

}



function normalizeId(value: unknown): string | null {

  if (typeof value !== 'string') return null;

  const trimmed = value.trim();

  return trimmed ? trimmed.toLowerCase() : null;

}



function collectRowCreatorIds(row: Record<string, unknown>): Set<string> {

  const ids = new Set<string>();

  for (const key of ['created_by_id', 'created_by', 'user_id', 'paid_to_user_id', 'salesman_id'] as const) {

    const normalized = normalizeId(row[key]);

    if (normalized) ids.add(normalized);

  }

  return ids;

}



function collectWorkerIdentityIds(authUserId: string, profileId?: string | null): Set<string> {

  const ids = new Set<string>();

  const auth = normalizeId(authUserId);

  if (auth) ids.add(auth);

  const profile = normalizeId(profileId);

  if (profile) ids.add(profile);

  return ids;

}



export function rowBelongsToCounterWorker(

  row: Record<string, unknown>,

  authUserId: string,

  profileId?: string | null,

): boolean {

  const workerIds = collectWorkerIdentityIds(authUserId, profileId);

  if (workerIds.size === 0) return false;

  const rowCreatorIds = collectRowCreatorIds(row);

  for (const id of rowCreatorIds) {

    if (workerIds.has(id)) return true;

  }

  return false;

}

/** Rental row visible to worker: created_by or salesman_id matches identity. */
export function rowBelongsToRentalWorker(
  row: Record<string, unknown>,
  authUserId: string,
  profileId?: string | null,
): boolean {
  if (rowBelongsToCounterWorker(row, authUserId, profileId)) return true;
  const workerIds = collectWorkerIdentityIds(authUserId, profileId);
  const salesman = normalizeId(row.salesman_id ?? row.salesmanId);
  return salesman != null && workerIds.has(salesman);
}

