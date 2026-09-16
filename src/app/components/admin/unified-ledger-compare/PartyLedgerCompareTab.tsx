import { useCallback, useEffect, useState } from 'react';
import type { UnifiedLedgerBasis, UnifiedPartyType } from '@/app/services/unifiedLedgerService';
import {
  comparePartyLedgerTieOut,
  GOLDEN_TIE_OUT_CONTACT_PATTERNS,
  type TieOutCompareResult,
} from '@/app/services/unifiedLedgerTieOutService';
import { MR_JALIL_EXPECTED_BALANCE, balanceMatchesGolden } from '@/app/lib/unifiedLedgerGoldenFixtures';
import { Button } from '@/app/components/ui/button';
import { LoadingSpinner } from '@/app/components/shared/LoadingSpinner';
import { CompareDiffTable, CompareSummaryCards, downloadCompareJson } from './CompareSummaryCards';
import type { CompareFilterState } from './compareFilters';

type ContactOption = { id: string; code: string; name: string; type: string };

export function PartyLedgerCompareTab(props: {
  companyId: string | null;
  contacts: ContactOption[];
  filters: CompareFilterState;
}) {
  const { companyId, contacts, filters } = props;
  const [partyType, setPartyType] = useState<UnifiedPartyType>('customer');
  const [contactId, setContactId] = useState('');
  const [useHybridOld, setUseHybridOld] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TieOutCompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadGolden = useCallback(
    (pattern: (typeof GOLDEN_TIE_OUT_CONTACT_PATTERNS)[number]) => {
      setPartyType(pattern.partyType);
      const match = contacts.find((c) => {
        if ('code' in pattern && pattern.code) {
          return String(c.code || '').trim() === pattern.code;
        }
        return String(c.name || '').toUpperCase().includes(pattern.namePattern);
      });
      if (match) setContactId(match.id);
    },
    [contacts]
  );

  const runCompare = useCallback(async () => {
    if (!companyId || !contactId) {
      setError('Select company and contact');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await comparePartyLedgerTieOut({
        companyId,
        partyType,
        contactId,
        branchId: filters.branchId,
        dateFrom: filters.dateFrom || null,
        dateTo: filters.dateTo || null,
        basis: filters.basis,
        useHybridOldEngine: partyType === 'customer' && useHybridOld,
      });
      setResult(r);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Compare failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, contactId, partyType, filters, useHybridOld]);

  const goldenPass =
    result &&
    contactId &&
    balanceMatchesGolden(MR_JALIL_EXPECTED_BALANCE, result.newBalance) &&
    balanceMatchesGolden(MR_JALIL_EXPECTED_BALANCE, result.oldBalance);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 rounded-xl border border-border bg-card/40 p-4">
        <label className="text-sm space-y-1">
          Party type
          <select
            className="w-full rounded bg-muted border border-border px-2 py-1.5"
            value={partyType}
            onChange={(e) => setPartyType(e.target.value as UnifiedPartyType)}
          >
            <option value="customer">Customer</option>
            <option value="supplier">Supplier</option>
            <option value="worker">Worker</option>
          </select>
        </label>
        <label className="text-sm space-y-1 md:col-span-2">
          Contact
          <select
            className="w-full rounded bg-muted border border-border px-2 py-1.5"
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
          >
            <option value="">— Select —</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code || c.type})
              </option>
            ))}
          </select>
        </label>
        {partyType === 'customer' && (
          <label className="text-sm flex items-center gap-2 pt-6">
            <input
              type="checkbox"
              checked={useHybridOld}
              onChange={(e) => setUseHybridOld(e.target.checked)}
            />
            Old engine = hybrid getCustomerLedger
          </label>
        )}
        <div className="flex items-end">
          <Button onClick={runCompare} disabled={loading}>
            {loading ? 'Comparing…' : 'Run compare'}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-muted-foreground w-full">Golden presets:</span>
        {GOLDEN_TIE_OUT_CONTACT_PATTERNS.map((p) => (
          <Button key={p.label} size="sm" variant="secondary" onClick={() => loadGolden(p)}>
            {p.label}
          </Button>
        ))}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {loading && <LoadingSpinner />}

      {result && (
        <div className="space-y-4">
          <CompareSummaryCards
            oldBalance={result.oldBalance}
            newBalance={result.newBalance}
            difference={result.difference}
            pass={Math.abs(result.difference) <= 0.01}
            oldRowCount={result.oldRowCount}
            newRowCount={result.newRowCount}
            oldEngineName={result.oldEngineName}
            newEngineName={result.newEngineName}
            oldQueryMs={result.oldQueryMs}
            newQueryMs={result.newQueryMs}
            extra={
              <>
                {goldenPass && (
                  <p className="text-emerald-400 text-sm">
                    MR JALIL golden balance match: PKR {MR_JALIL_EXPECTED_BALANCE.toLocaleString()}
                  </p>
                )}
                {result.correctionReversalHiddenInEffective && (
                  <p className="text-emerald-400 text-sm">
                    effective_party correctly hides JE-0168-class reversals in new engine.
                  </p>
                )}
              </>
            }
          />
          <CompareDiffTable title={`Missing in new (${result.missingInNew.length})`} rows={result.missingInNew} />
          <CompareDiffTable title={`Extra in new (${result.extraInNew.length})`} rows={result.extraInNew} />
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              downloadCompareJson(`phase2-compare-party-${Date.now()}.json`, result)
            }
          >
            Export JSON
          </Button>
        </div>
      )}
    </div>
  );
}
