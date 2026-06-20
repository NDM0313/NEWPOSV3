/**
 * Developer-only Unified Ledger Tie-Out — shadow compare old vs new engine.
 * Route: /admin/unified-ledger-tieout
 * Does NOT replace production ledger screens.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { canAccessAccountingDeveloperCenter } from '@/app/lib/accountingDeveloperCenterAccess';
import {
  comparePartyLedgerTieOut,
  GOLDEN_TIE_OUT_CONTACT_PATTERNS,
  type TieOutCompareResult,
} from '@/app/services/unifiedLedgerTieOutService';
import type { UnifiedLedgerBasis, UnifiedPartyType } from '@/app/services/unifiedLedgerService';
import {
  getUnifiedLedgerLocalOverride,
  isUnifiedLedgerEngineEnabledSync,
  setUnifiedLedgerLocalOverride,
} from '@/app/lib/unifiedLedgerFeatureFlag';
import { unifiedBasisLabel } from '@/app/services/unifiedLedgerService';
import { supabase } from '@/lib/supabase';
import { LoadingSpinner } from '@/app/components/shared/LoadingSpinner';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { getTodayYYYYMMDD } from '@/app/components/ui/utils';

type ContactOption = { id: string; code: string; name: string; type: string };

const BASIS_OPTIONS: UnifiedLedgerBasis[] = [
  'official_gl',
  'effective_party',
  'audit_full_history',
];

export default function UnifiedLedgerTieOutPage() {
  const { companyId, userRole } = useSupabase();
  const canAccess = canAccessAccountingDeveloperCenter(userRole);

  const [partyType, setPartyType] = useState<UnifiedPartyType>('customer');
  const [basis, setBasis] = useState<UnifiedLedgerBasis>('effective_party');
  const [contactId, setContactId] = useState('');
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState(getTodayYYYYMMDD());
  const [useHybridOld, setUseHybridOld] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TieOutCompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flagSync, setFlagSync] = useState(0);

  const flagEnabled = useMemo(() => isUnifiedLedgerEngineEnabledSync(), [flagSync]);
  const localOverride = useMemo(() => getUnifiedLedgerLocalOverride(), [flagSync]);

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const { data } = await supabase
        .from('contacts')
        .select('id, code, name, type')
        .eq('company_id', companyId)
        .order('name');
      setContacts((data || []) as ContactOption[]);
    })();
  }, [companyId]);

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
        branchId: null,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        basis,
        useHybridOldEngine: partyType === 'customer' && useHybridOld,
      });
      setResult(r);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Tie-out failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, contactId, partyType, dateFrom, dateTo, basis, useHybridOld]);

  if (!canAccess) {
    return (
      <div className="p-8 text-white">
        <h1 className="text-xl font-semibold">Unified Ledger Tie-Out</h1>
        <p className="text-gray-400 mt-2">Developer / admin access required.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] text-white p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Unified Ledger Tie-Out (Shadow)</h1>
        <p className="text-gray-400 text-sm mt-1">
          Compare legacy engine vs <code className="text-amber-300">get_unified_party_ledger</code>.
          Production screens unchanged. Feature flag:{' '}
          <Badge variant="outline">{flagEnabled ? 'ON' : 'OFF'}</Badge>
          {localOverride !== null && (
            <span className="ml-2 text-xs text-amber-400">localStorage override: {String(localOverride)}</span>
          )}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setUnifiedLedgerLocalOverride(null);
            setFlagSync((n) => n + 1);
          }}
        >
          Clear flag override
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setUnifiedLedgerLocalOverride(true);
            setFlagSync((n) => n + 1);
          }}
        >
          Dev: force flag ON
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setUnifiedLedgerLocalOverride(false);
            setFlagSync((n) => n + 1);
          }}
        >
          Dev: force flag OFF
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 rounded-xl border border-gray-800 bg-gray-900/40 p-4">
        <label className="text-sm space-y-1">
          Party type
          <select
            className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1.5"
            value={partyType}
            onChange={(e) => setPartyType(e.target.value as UnifiedPartyType)}
          >
            <option value="customer">Customer</option>
            <option value="supplier">Supplier</option>
            <option value="worker">Worker</option>
          </select>
        </label>
        <label className="text-sm space-y-1">
          Basis
          <select
            className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1.5"
            value={basis}
            onChange={(e) => setBasis(e.target.value as UnifiedLedgerBasis)}
          >
            {BASIS_OPTIONS.map((b) => (
              <option key={b} value={b}>
                {unifiedBasisLabel(b)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm space-y-1 md:col-span-2">
          Contact
          <select
            className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1.5"
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
        <label className="text-sm space-y-1">
          From
          <input
            type="date"
            className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1.5"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </label>
        <label className="text-sm space-y-1">
          To
          <input
            type="date"
            className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1.5"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
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
            {loading ? 'Comparing…' : 'Run tie-out'}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-gray-500 w-full">Golden presets:</span>
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Old balance" value={result.oldBalance} />
            <StatCard label="New balance" value={result.newBalance} />
            <StatCard label="Difference" value={result.difference} highlight={Math.abs(result.difference) > 0.01} />
            <StatCard label="Basis" value={result.basis} text />
          </div>
          <div className="text-sm text-gray-400 grid md:grid-cols-2 gap-2">
            <p>
              Old: <strong className="text-white">{result.oldEngineName}</strong> ({result.oldRowCount} rows,{' '}
              {result.oldQueryMs.toFixed(0)} ms)
            </p>
            <p>
              New: <strong className="text-white">{result.newEngineName}</strong> ({result.newRowCount} rows,{' '}
              {result.newQueryMs.toFixed(0)} ms)
            </p>
            <p>Correction reversals in old: {result.correctionReversalInOld}</p>
            <p>Correction reversals in new: {result.correctionReversalInNew}</p>
            {result.correctionReversalHiddenInEffective && (
              <p className="text-emerald-400 col-span-2">
                effective_party correctly hides JE-0168-class reversals in new engine.
              </p>
            )}
          </div>

          <DiffTable title={`Missing in new (${result.missingInNew.length})`} rows={result.missingInNew} />
          <DiffTable title={`Extra in new (${result.extraInNew.length})`} rows={result.extraInNew} />
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
  text,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
  text?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${highlight ? 'border-amber-500/50 bg-amber-500/10' : 'border-gray-800 bg-gray-900/50'}`}
    >
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-mono mt-1">
        {text ? String(value) : typeof value === 'number' ? value.toLocaleString(undefined, { minimumFractionDigits: 2 }) : value}
      </div>
    </div>
  );
}

function DiffTable({
  title,
  rows,
}: {
  title: string;
  rows: TieOutCompareResult['missingInNew'];
}) {
  if (!rows.length) {
    return (
      <div className="rounded-lg border border-gray-800 p-3 text-sm text-gray-500">
        {title}: none
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-gray-800 overflow-hidden">
      <div className="px-3 py-2 bg-gray-900/80 text-sm font-medium">{title}</div>
      <div className="overflow-x-auto max-h-64">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-500 border-b border-gray-800">
              <th className="text-left p-2">Entry</th>
              <th className="text-left p-2">Date</th>
              <th className="text-left p-2">Type</th>
              <th className="text-right p-2">Dr</th>
              <th className="text-right p-2">Cr</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 50).map((r, i) => (
              <tr key={`${r.journalEntryId}-${i}`} className="border-b border-gray-800/50">
                <td className="p-2">{r.entryNo || r.journalEntryId.slice(0, 8)}</td>
                <td className="p-2">{r.entryDate}</td>
                <td className="p-2">{r.referenceType || '—'}</td>
                <td className="p-2 text-right">{r.debit.toFixed(2)}</td>
                <td className="p-2 text-right">{r.credit.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
