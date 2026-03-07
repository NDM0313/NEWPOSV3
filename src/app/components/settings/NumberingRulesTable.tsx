/**
 * Settings → Numbering Rules – ERP document numbering (erp_document_sequences).
 * Table: Module | Prefix | Digits | Year Reset | Branch Based | Preview.
 * Save Rules / Reset Defaults.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { settingsService } from '@/app/services/settingsService';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Switch } from '@/app/components/ui/switch';
import { Loader2, Save, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

const SENTINEL = '00000000-0000-0000-0000-000000000000';

/** Document = transaction (invoice, payment). Master = permanent record (product, customer). */
const MODULES: { document_type: string; label: string; defaultPrefix: string; type: 'Document' | 'Master' }[] = [
  { document_type: 'SALE', label: 'Sale', defaultPrefix: 'SL', type: 'Document' },
  { document_type: 'PURCHASE', label: 'Purchase', defaultPrefix: 'PUR', type: 'Document' },
  { document_type: 'PAYMENT', label: 'Payment', defaultPrefix: 'PAY', type: 'Document' },
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
  last_number: number;
  type?: 'Document' | 'Master';
}

function previewNumber(prefix: string, padding: number): string {
  const p = (prefix || '').trim().replace(/-$/, '');
  const num = 1;
  return p ? `${p}-${String(num).padStart(Math.max(1, padding), '0')}` : '—';
}

export function NumberingRulesTable() {
  const { companyId } = useSupabase();
  const [rows, setRows] = useState<NumberingRuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const data = await settingsService.getErpDocumentSequences(companyId, null);
      const byType = new Map(data.map((r) => [r.document_type.toUpperCase(), r]));
      const merged: NumberingRuleRow[] = MODULES.map((m) => {
        const existing = byType.get(m.document_type);
        return {
          document_type: m.document_type,
          prefix: existing?.prefix ?? m.defaultPrefix,
          padding: existing?.padding ?? 4,
          year_reset: existing?.year_reset ?? (m.type === 'Master' ? false : true),
          branch_based: existing?.branch_based ?? false,
          last_number: existing?.last_number ?? 0,
          type: m.type,
        };
      });
      setRows(merged);
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
          last_number: 0,
          type: m.type,
        }))
      );
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  const updateRow = (documentType: string, patch: Partial<NumberingRuleRow>) => {
    setRows((prev) =>
      prev.map((r) => (r.document_type === documentType ? { ...r, ...patch } : r))
    );
  };

  const handleSave = async () => {
    if (!companyId) return;
    setSaving(true);
    try {
      for (const row of rows) {
        await settingsService.setErpDocumentSequence(
          companyId,
          null,
          row.document_type,
          row.prefix,
          undefined,
          row.padding,
          row.year_reset,
          row.branch_based
        );
      }
      toast.success('Numbering rules saved');
      await load();
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
        };
      })
    );
    toast.info('Defaults restored in form. Click Save Rules to apply.');
  };

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
        Configure prefixes and digits for document numbers. Next numbers are generated by the ERP engine (no duplicates).
      </p>
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
                <th className="px-4 py-3 text-left font-medium w-28">Preview</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {rows.map((r) => (
                <tr key={r.document_type} className="hover:bg-gray-800/30 bg-gray-950/30">
                  <td className="px-4 py-3 text-white font-medium">{r.document_type.charAt(0) + r.document_type.slice(1).toLowerCase()}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs uppercase tracking-wide">{r.type ?? 'Document'}</td>
                  <td className="px-4 py-3">
                    <Input
                      value={r.prefix}
                      onChange={(e) => updateRow(r.document_type, { prefix: e.target.value.replace(/-/g, '').toUpperCase().slice(0, 8) })}
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
                      onChange={(e) => updateRow(r.document_type, { padding: Math.min(8, Math.max(1, Number(e.target.value) || 4)) })}
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
                  <td className="px-4 py-3 font-mono text-gray-300">
                    {previewNumber(r.prefix, r.padding)}
                  </td>
                </tr>
              ))}
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
