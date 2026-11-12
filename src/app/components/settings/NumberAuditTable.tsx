/**
 * Settings → Number Audit Log – Cancelled/deleted document numbers (never reused).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { supabase } from '@/lib/supabase';
import { Loader2, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { friendlyNumberingDocumentType } from '@/app/lib/numberingDocumentTypeLabels';

export interface AuditRow {
  id: string;
  document_type: string;
  document_number: string;
  reference_type: string;
  reference_id: string;
  reason: string | null;
  deleted_at: string;
  created_at: string;
}

export function NumberAuditTable() {
  const { companyId } = useSupabase();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('erp_document_number_audit')
        .select('id, document_type, document_number, reference_type, reference_id, reason, deleted_at, created_at')
        .eq('company_id', companyId)
        .order('deleted_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      setRows((data || []) as AuditRow[]);
    } catch (e) {
      console.error('[NumberAuditTable] load error:', e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Cancelled or deleted document numbers are logged here. These numbers are never reused.
      </p>
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-card text-muted-foreground border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-medium w-24">Type</th>
                <th className="px-4 py-3 text-left font-medium w-28">Document No</th>
                <th className="px-4 py-3 text-left font-medium w-24">Reference</th>
                <th className="px-4 py-3 text-left font-medium flex-1">Reason</th>
                <th className="px-4 py-3 text-left font-medium w-36">Deleted At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    No audit entries yet. Cancelled invoices and POs will appear here.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-accent/30 bg-muted/30">
                  <td className="px-4 py-3 text-muted-foreground">{friendlyNumberingDocumentType(r.document_type)}</td>
                  <td className="px-4 py-3 font-mono text-foreground">{r.document_number || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.reference_type} ({r.reference_id?.slice(0, 8)}…)</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.reason || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.deleted_at ? format(new Date(r.deleted_at), 'dd MMM yyyy HH:mm') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
