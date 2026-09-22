/**
 * ARIF golden fixture + thin compatibility wrappers over supplierBusinessGl.
 * Prefer importing from supplierBusinessGl for new system-wide wiring.
 */

export const ARIF_PILOT_COMPANY_ID = 'e08a04af-22a8-4869-9b4d-da31fce13158';
export const ARIF_PILOT_CONTACT_ID = '21e1ac76-b911-44a1-87dd-6283969efa4c';
export const ARIF_PILOT_LEGACY_ACCOUNT_CODE = '210017';
export const ARIF_PILOT_LEGACY_ACCOUNT_ID = '719c0bab-9484-4cff-84b8-8a0f0ffecffd';
export const ARIF_PILOT_CONTACT_NAME = 'ARIF LHR';

export type {
  SupplierStatementViewMode as ArifPilotViewMode,
  SupplierBusinessHistoryResult as ArifBusinessHistoryResult,
  SupplierBusinessHistoryTotals as ArifBusinessHistoryTotals,
  SupplierAttributedLineLike as ArifAttributedLineLike,
} from './supplierBusinessGl';

export {
  dedupeAttributedRowsByJournalLineId,
  splitSupplierBusinessHistoryRows as splitArifBusinessHistoryRows,
  computeSupplierBusinessHistoryTotals as computeArifBusinessHistoryTotals,
  buildSupplierBusinessHistoryStatementRows as buildArifBusinessHistoryStatementRows,
  mapSupplierBusinessHistoryToV2Rows as mapArifBusinessHistoryToV2Rows,
  loadSupplierBusinessHistory,
} from './supplierBusinessGl';

export function isArifSupplierBusinessPilot(
  companyId: string | null | undefined,
  contactId: string | null | undefined,
): boolean {
  return (
    String(companyId || '') === ARIF_PILOT_COMPANY_ID &&
    String(contactId || '') === ARIF_PILOT_CONTACT_ID
  );
}

export async function loadArifBusinessHistory(params: {
  companyId: string;
  contactId: string;
  branchId?: string | null;
  startDate: string;
  endDate: string;
}) {
  if (!isArifSupplierBusinessPilot(params.companyId, params.contactId)) return null;
  const { loadSupplierBusinessHistory } = await import('./supplierBusinessGl');
  return loadSupplierBusinessHistory(params);
}
