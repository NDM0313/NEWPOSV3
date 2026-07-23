export type UnifiedPartyType = 'customer' | 'supplier' | 'worker';
export type UnifiedLedgerBasis = 'official_gl' | 'effective_party' | 'audit_full_history';

export type LegacyEngineLabel =
  | 'legacy_gl_rpc'
  | 'hybrid_frontend_equivalent'
  | 'operational_open_items';

export type CompanyTieOutRow = {
  companyId: string;
  companyName: string;
  branchId: string | null;
  branchLabel: string | null;
  contactId: string;
  contactName: string;
  contactCode: string | null;
  partyType: UnifiedPartyType;
  basis: UnifiedLedgerBasis;
  legacyEngine: LegacyEngineLabel;
  oldBalance: number;
  newBalance: number;
  difference: number;
  oldRowCount: number;
  newRowCount: number;
  pass: boolean;
  oldEngineName: string;
  newEngineName: string;
};

export type AllCompanyTieOutSummary = {
  companiesScanned: number;
  contactsCompared: number;
  passCount: number;
  failCount: number;
  maxAbsDifference: number;
  rows: CompanyTieOutRow[];
  unresolved: CompanyTieOutRow[];
};

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function summarizeAllCompanyTieOut(rows: CompanyTieOutRow[]): AllCompanyTieOutSummary {
  const unresolved = rows.filter((r) => !r.pass);
  const passCount = rows.filter((r) => r.pass).length;
  const companies = new Set(rows.map((r) => r.companyId));
  const maxAbsDifference = rows.reduce((m, r) => Math.max(m, Math.abs(r.difference)), 0);

  return {
    companiesScanned: companies.size,
    contactsCompared: rows.length,
    passCount,
    failCount: unresolved.length,
    maxAbsDifference: round2(maxAbsDifference),
    rows,
    unresolved,
  };
}
