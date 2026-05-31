/**
 * Settings → Numbering Rules – ERP document numbering (erp_document_sequences).
 * Table: Module | Prefix | Digits | Year Reset | Branch Based | Preview.
 * Save Rules / Reset Defaults.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { settingsService, isNumberingIncludeBranchCodeSupported } from '@/app/services/settingsService';
import { branchService, type Branch } from '@/app/services/branchService';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Switch } from '@/app/components/ui/switch';
import { Label } from '@/app/components/ui/label';
import { Loader2, Save, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

/** Document = transaction (invoice, payment). Master = permanent record (product, customer). */
const MODULES: { document_type: string; label: string; defaultPrefix: string; type: 'Document' | 'Master' }[] = [
  { document_type: 'SALE', label: 'Sale', defaultPrefix: 'SL', type: 'Document' },
  { document_type: 'PURCHASE', label: 'Purchase', defaultPrefix: 'PUR', type: 'Document' },
  { document_type: 'PAYMENT', label: 'Outgoing payment', defaultPrefix: 'PAY', type: 'Document' },
  { document_type: 'CUSTOMER_RECEIPT', label: 'Customer receipt', defaultPrefix: 'RCV', type: 'Document' },
  { document_type: 'EXPENSE', label: 'Expense', defaultPrefix: 'EXP', type: 'Document' },
  { document_type: 'RENTAL', label: 'Rental', defaultPrefix: 'REN', type: 'Document' },
  { document_type: 'STUDIO', label: 'Studio', defaultPrefix: 'STD', type: 'Document' },
  { document_type: 'POS', label: 'POS', defaultPrefix: 'POS', type: 'Document' },
  { document_type: 'PRODUCT', label: 'Product', defaultPrefix: 'PRD', type: 'Master' },
  { document_type: 'CUSTOMER', label: 'Customer', defaultPrefix: 'CUS', type: 'Master' },
  { document_type: 'SUPPLIER', label: 'Supplier', defaultPrefix: 'SUP', type: 'Master' },
  { document_type: 'WORKER', label: 'Worker', defaultPrefix: 'WRK', type: 'Master' },
  { document_type: 'JOB', label: 'Studio Job', defaultPrefix: 'JOB', type: 'Master' },
];

export interface NumberingRuleRow {
  document_type: string;
  prefix: string;
  padding: number;
  year_reset: boolean;
  branch_based: boolean;
  include_branch_code: boolean;
  last_number: number;
  type?: 'Document' | 'Master';
}

type BranchLastNumberMap = Record<string, number>;

function normalizeBranchCode(code?: string | null): string {
  return String(code || '')
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]/g, '');
}

function previewDocumentNumber(row: NumberingRuleRow, lastNumber: number, branchCode?: string | null): string {
  const p = (row.prefix || '').trim().replace(/-$/, '');
  if (!p) return '—';
  const next = (lastNumber ?? 0) + 1;
  const padded = String(next).padStart(Math.max(1, row.padding), '0');
  let formatted: string;
  if (row.year_reset) {
    const yy = String(new Date().getFullYear()).slice(-2);
    formatted = `${p}-${yy}-${padded}`;
  } else {
    formatted = `${p}-${padded}`;
  }
  const code = normalizeBranchCode(branchCode);
  if (row.include_branch_code && row.branch_based && code) {
    return `${code}-${formatted}`;
  }
  return formatted;
}

function mergeSequences(
  data: Awaited<ReturnType<typeof settingsService.getErpDocumentSequences>>,
): NumberingRuleRow[] {
  const byType = new Map(data.map((r) => [r.document_type.toUpperCase(), r]));
  return MODULES.map((m) => {
    const existing = byType.get(m.document_type);
    return {
      document_type: m.document_type,
      prefix: existing?.prefix ?? m.defaultPrefix,
      padding: existing?.padding ?? 4,
      year_reset: existing?.year_reset ?? (m.type === 'Master' ? false : true),
      branch_based: existing?.branch_based ?? false,
      include_branch_code: existing?.include_branch_code ?? false,
      last_number: existing?.last_number ?? 0,
      type: m.type,
    };
  });
}

export function NumberingRulesTable() {
  const { companyId } = useSupabase();
  const [rows, setRows] = useState<NumberingRuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [branchLastNumbers, setBranchLastNumbers] = useState<Record<string, BranchLastNumberMap>>({});
  const [loadingBranchSeq, setLoadingBranchSeq] = useState(false);
  const [branchCodeColumnSupported, setBranchCodeColumnSupported] = useState(true);

  const selectedBranch = useMemo(
    () => branches.find((b) => b.id === selectedBranchId) ?? null,
    [branches, selectedBranchId],
  );

  const loadCompanyRules = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const data = await settingsService.getErpDocumentSequences(companyId, null);
      setBranchCodeColumnSupported(isNumberingIncludeBranchCodeSupported());
      setRows(mergeSequences(data));
    } catch (e) {
      console.error('[NumberingRulesTable] load error:', e);
      toast.error('Failed to load numbering rules');
      setRows(
        MODULES.map((m) => ({
          document_type: m.document_type,
          prefix: m.defaultPrefix,
          padding: 4,
          year_reset: m.type === 'Master' ? false : true,
          branch_based: false,
          include_branch_code: false,
          last_number: 0,
          type: m.type,
        })),
      );
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  const loadBranches = useCallback(async () => {
    if (!companyId) return;
    try {
      const list = await branchService.getAllBranches(companyId);
      const active = (list || []).filter((b) => b.is_active !== false);
      setBranches(active);
      setSelectedBranchId((prev) => prev || active[0]?.id || '');
    } catch (e) {
      console.error('[NumberingRulesTable] branches load error:', e);
      setBranches([]);
    }
  }, [companyId]);

  const loadBranchSequences = useCallback(
    async (branchId: string, force = false) => {
      if (!companyId || !branchId) return;
      setLoadingBranchSeq(true);
      try {
        const data = await settingsService.getErpDocumentSequences(companyId, branchId);
        const map: BranchLastNumberMap = {};
        data.forEach((r) => {
          map[r.document_type.toUpperCase()] = r.last_number ?? 0;
        });
        setBranchLastNumbers((prev) => {
          if (!force && prev[branchId]) return prev;
          return { ...prev, [branchId]: map };
        });
      } catch (e) {
        console.error('[NumberingRulesTable] branch sequences load error:', e);
      } finally {
        setLoadingBranchSeq(false);
      }
    },
    [companyId],
  );

  useEffect(() => {
    loadCompanyRules();
    loadBranches();
  }, [loadCompanyRules, loadBranches]);

  useEffect(() => {
    if (selectedBranchId) {
      loadBranchSequences(selectedBranchId);
    }
  }, [selectedBranchId, loadBranchSequences]);

  const resolveLastNumber = (row: NumberingRuleRow): number => {
    if (row.branch_based && selectedBranchId) {
      const branchMap = branchLastNumbers[selectedBranchId];
      if (branchMap && row.document_type.toUpperCase() in branchMap) {
        return branchMap[row.document_type.toUpperCase()] ?? 0;
      }
    }
    return row.last_number ?? 0;
  };

  const updateRow = (documentType: string, patch: Partial<NumberingRuleRow>) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.document_type !== documentType) return r;
        const next = { ...r, ...patch };
        if (patch.branch_based === false) {
          next.include_branch_code = false;
        }
        return next;
      }),
    );
    if ((patch.branch_based || patch.include_branch_code) && selectedBranchId) {
      loadBranchSequences(selectedBranchId);
    }
  };

  const handleSave = async () => {
    if (!companyId) return;
    setSaving(true);
    try {
      let wantedBranchCode = false;
      let appliedBranchCode = false;
      for (const row of rows) {
        if (row.include_branch_code && row.branch_based) wantedBranchCode = true;
        const result = await settingsService.setErpDocumentSequence(
          companyId,
          null,
          row.document_type,
          row.prefix,
          undefined,
          row.padding,
          row.year_reset,
          row.branch_based,
          row.include_branch_code,
        );
        if (result.includeBranchCodeApplied) appliedBranchCode = true;
      }
      setBranchCodeColumnSupported(isNumberingIncludeBranchCodeSupported());
      if (wantedBranchCode && !appliedBranchCode && !isNumberingIncludeBranchCodeSupported()) {
        toast.warning(
          'Branch Code column DB par nahi — admin se migration apply karwaein (include_branch_code).',
        );
      }
      toast.success('Numbering rules saved');
      setBranchLastNumbers({});
      await loadCompanyRules();
      if (selectedBranchId) {
        await loadBranchSequences(selectedBranchId, true);
      }
    } catch (e) {
      console.error('[NumberingRulesTable] save error:', e);
      toast.error('Failed to save numbering rules');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setRows((prev) =>
      prev.map((r) => {
        const m = MODULES.find((x) => x.document_type === r.document_type);
        return {
          ...r,
          prefix: m?.defaultPrefix ?? r.prefix,
          padding: 4,
          year_reset: true,
          branch_based: false,
          include_branch_code: false,
        };
      }),
    );
    toast.info('Defaults restored in form. Click Save Rules to apply.');
  };

  const hasBranchBasedRows = rows.some((r) => r.branch_based);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-400">
        Configure prefixes and digits for document numbers. Preview next number engine ke mutabiq hai (last issued + 1).
      </p>

      {!branchCodeColumnSupported ? (
        <p className="text-xs text-amber-400/90 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2">
          Branch Code feature ke liye DB migration chahiye (`include_branch_code` column). Baqi numbering rules save ho sakti hain.
        </p>
      ) : null}

      {hasBranchBasedRows && branches.length > 0 ? (
        <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-4 space-y-2">
          <Label className="text-gray-300">Preview branch (Branch Based rules ke liye)</Label>
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} {b.code ? `(${b.code})` : ''}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500">
            Branch Based ON = har branch ka alag counter. Branch Code ON = number mein branch code embed (maslan CR-SL-0001).
            {loadingBranchSeq ? ' Branch sequences load ho rahe hain…' : null}
          </p>
        </div>
      ) : null}

      <div className="rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-900/80 text-gray-400 border-b border-gray-800">
              <tr>
                <th className="px-4 py-3 text-left font-medium w-28">Module</th>
                <th className="px-4 py-3 text-left font-medium w-20">Type</th>
                <th className="px-4 py-3 text-left font-medium w-32">Prefix</th>
                <th className="px-4 py-3 text-left font-medium w-24">Digits</th>
                <th className="px-4 py-3 text-left font-medium w-28">Year Reset</th>
                <th className="px-4 py-3 text-left font-medium w-28">Branch Based</th>
                <th className="px-4 py-3 text-left font-medium w-28">Branch Code</th>
                <th className="px-4 py-3 text-left font-medium min-w-[140px]">Preview</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {rows.map((r) => {
                const lastNum = resolveLastNumber(r);
                const preview = previewDocumentNumber(r, lastNum, selectedBranch?.code);
                return (
                  <tr key={r.document_type} className="hover:bg-gray-800/30 bg-gray-950/30">
                    <td className="px-4 py-3 text-white font-medium">
                      {r.document_type.charAt(0) + r.document_type.slice(1).toLowerCase()}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs uppercase tracking-wide">{r.type ?? 'Document'}</td>
                    <td className="px-4 py-3">
                      <Input
                        value={r.prefix}
                        onChange={(e) =>
                          updateRow(r.document_type, {
                            prefix: e.target.value.replace(/-/g, '').toUpperCase().slice(0, 8),
                          })
                        }
                        className="bg-gray-900 border-gray-700 text-white w-24 font-mono"
                        maxLength={8}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        min={1}
                        max={8}
                        value={r.padding}
                        onChange={(e) =>
                          updateRow(r.document_type, {
                            padding: Math.min(8, Math.max(1, Number(e.target.value) || 4)),
                          })
                        }
                        className="bg-gray-900 border-gray-700 text-white w-20"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Switch
                        checked={r.year_reset}
                        onCheckedChange={(v) => updateRow(r.document_type, { year_reset: v })}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Switch
                        checked={r.branch_based}
                        onCheckedChange={(v) => updateRow(r.document_type, { branch_based: v })}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Switch
                        checked={r.include_branch_code}
                        disabled={!r.branch_based || !branchCodeColumnSupported}
                        title={
                          !branchCodeColumnSupported
                            ? 'Branch Code column DB par nahi — migration apply karein'
                            : !r.branch_based
                              ? 'Pehle Branch Based ON karein'
                              : undefined
                        }
                        onCheckedChange={(v) => updateRow(r.document_type, { include_branch_code: v })}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-gray-300">{preview}</div>
                      {r.branch_based && selectedBranch ? (
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          Branch: {selectedBranch.name}
                          {selectedBranch.code ? ` (${selectedBranch.code})` : ''}
                          {r.include_branch_code && !normalizeBranchCode(selectedBranch.code) ? ' — branch code set karein (Settings → Branches)' : ''}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-green-600 hover:bg-green-500 text-white gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Rules
        </Button>
        <Button
          onClick={handleResetDefaults}
          variant="outline"
          className="border-gray-600 text-gray-300 hover:bg-gray-800 gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Reset Defaults
        </Button>
      </div>
    </div>
  );
}
