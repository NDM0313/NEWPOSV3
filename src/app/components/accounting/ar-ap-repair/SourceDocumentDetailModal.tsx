import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import type { UnpostedDocumentRow } from '@/app/services/arApReconciliationCenterService';
import { diagnoseUnpostedRow, diagnoseUnmappedLine } from '@/app/lib/arApReconciliationDiagnostics';
import { loadUnpostedTrace, loadUnmappedTrace } from '@/app/services/arApReconciliationTraceService';
import { FalsePositiveBadge, PostabilityBadge, RiskBadge } from './ArApRepairBadges';

export function SourceDocumentDetailModal(props: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  row: UnpostedDocumentRow | null;
  onOpenDryRun?: () => void;
  readOnly?: boolean;
}) {
  const { formatCurrency } = useFormatCurrency();
  const [loading, setLoading] = useState(false);
  const [bundle, setBundle] = useState<Awaited<ReturnType<typeof loadUnpostedTrace>> | null>(null);

  useEffect(() => {
    if (!props.open || !props.row) {
      setBundle(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    loadUnpostedTrace(props.row)
      .then((b) => {
        if (!cancelled) setBundle(b);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [props.open, props.row]);

  if (!props.row) return null;

  const diag = diagnoseUnpostedRow(props.row, bundle?.enrichment?.status);
  const activeJe = (bundle?.linkedJournals || []).filter((j) => !j.is_void);
  const voidJe = (bundle?.linkedJournals || []).filter((j) => j.is_void);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="bg-gray-950 border-gray-800 text-white max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Source document (read-only)</DialogTitle>
          <DialogDescription className="text-gray-400">No data changes — trace and risk assessment only.</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-2">
              <PostabilityBadge label={diag.label} isNonFinal={diag.isNonFinal} />
              <RiskBadge level={diag.riskLevel} />
            </div>
            <dl className="rounded-lg border border-gray-800 bg-gray-900/60 p-3 space-y-1.5">
              <Row label="Document" value={props.row.document_no || props.row.source_id} />
              <Row label="Type" value={props.row.source_type} />
              <Row label="Contact" value={props.row.contact_name || '—'} />
              <Row label="Status" value={bundle?.enrichment?.status || '—'} />
              <Row label="Total" value={bundle?.enrichment?.total != null ? formatCurrency(bundle.enrichment.total) : '—'} />
              <Row label="Paid" value={bundle?.enrichment?.paid_amount != null ? formatCurrency(bundle.enrichment.paid_amount) : '—'} />
              <Row label="Due (queue amt)" value={formatCurrency(Number(props.row.amount) || 0)} />
              <Row label="Branch" value={bundle?.enrichment?.branch_name || props.row.branch_id?.slice(0, 8) || '—'} />
              <Row label="Date" value={props.row.document_date || '—'} />
            </dl>
            <Section title="GL posting status">
              {activeJe.length === 0 ? (
                <p className="text-gray-400 text-xs">No active sale/purchase document JE.</p>
              ) : (
                activeJe.map((j) => (
                  <p key={j.id} className="text-xs font-mono text-blue-300">
                    {j.entry_no || j.id.slice(0, 8)} (active)
                  </p>
                ))
              )}
              {voidJe.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">{voidJe.length} void JE(s) on file.</p>
              )}
            </Section>
            {Array.isArray(bundle?.enrichment?.attachments) && bundle.enrichment.attachments.length > 0 && (
              <Section title="Attachments">
                <p className="text-xs text-gray-400">{bundle.enrichment.attachments.length} attachment(s) on source document.</p>
              </Section>
            )}
            <Section title="Why in queue">{diag.queueReason}</Section>
            <Section title="Suggested next action">{diag.suggestedAction}</Section>
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" className="border-gray-700" onClick={() => props.onOpenChange(false)}>
            Close
          </Button>
          {!props.readOnly && props.onOpenDryRun && (
            <Button className="bg-blue-600 hover:bg-blue-500" onClick={props.onOpenDryRun}>
              Open posting dry-run…
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row(props: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-500 shrink-0">{props.label}</dt>
      <dd className="text-gray-200 text-right break-all">{props.value}</dd>
    </div>
  );
}

function Section(props: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-1">{props.title}</p>
      <div className="text-xs text-gray-300 leading-relaxed">{props.children}</div>
    </div>
  );
}

export function UnmappedSourceDetailModal(props: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onOpenRelinkDryRun?: () => void;
  onOpenTrace?: () => void;
  loading?: boolean;
  title: string;
  children: React.ReactNode;
  readOnly?: boolean;
}) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="bg-gray-950 border-gray-800 text-white max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
          <DialogDescription className="text-gray-400">Read-only trace — Phase 2 safe UI.</DialogDescription>
        </DialogHeader>
        {props.loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          </div>
        ) : (
          props.children
        )}
        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="outline" className="border-gray-700" onClick={() => props.onOpenChange(false)}>
            Close
          </Button>
          {props.onOpenTrace && (
            <Button variant="outline" className="border-gray-600" onClick={props.onOpenTrace}>
              Full trace panel
            </Button>
          )}
          {!props.readOnly && props.onOpenRelinkDryRun && (
            <Button className="bg-emerald-700 hover:bg-emerald-600" onClick={props.onOpenRelinkDryRun}>
              Relink dry-run…
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { FalsePositiveBadge };

export function UnmappedRowDetailModal(props: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  row: import('@/app/services/arApReconciliationCenterService').UnmappedJournalRow | null;
  onOpenRelinkDryRun?: () => void;
  onOpenTrace?: () => void;
  readOnly?: boolean;
}) {
  const { formatCurrency } = useFormatCurrency();
  const [loading, setLoading] = useState(false);
  const [bundle, setBundle] = useState<Awaited<ReturnType<typeof loadUnmappedTrace>> | null>(null);

  useEffect(() => {
    if (!props.open || !props.row) {
      setBundle(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    loadUnmappedTrace(props.row)
      .then((b) => {
        if (!cancelled) setBundle(b);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [props.open, props.row]);

  if (!props.row) return null;

  const diag = diagnoseUnmappedLine(
    props.row,
    bundle?.payment ?? undefined,
    bundle?.lineAccount?.linked_contact_id
  );

  return (
    <UnmappedSourceDetailModal
      open={props.open}
      onOpenChange={props.onOpenChange}
      loading={loading}
      title="Unmapped line (read-only)"
      onOpenRelinkDryRun={props.onOpenRelinkDryRun}
      onOpenTrace={props.onOpenTrace}
      readOnly={props.readOnly}
    >
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-2">
          <RiskBadge level={diag.riskLevel} />
          {diag.isLikelyFalsePositive && <FalsePositiveBadge />}
        </div>
        {diag.isLikelyFalsePositive && diag.falsePositiveReason && (
          <p className="text-cyan-200/90 text-xs rounded-lg border border-cyan-500/30 bg-cyan-950/20 p-2">{diag.falsePositiveReason}</p>
        )}
        <dl className="rounded-lg border border-gray-800 bg-gray-900/60 p-3 space-y-1.5">
          <Row label="JE" value={bundle?.journal?.entry_no || props.row.entry_no || '—'} />
          <Row label="Payment ref" value={bundle?.payment?.reference_number || '—'} />
          <Row label="Account" value={`${props.row.account_name} (${props.row.account_code})`} />
          <Row
            label="Line"
            value={`Dr ${formatCurrency(Number(props.row.debit) || 0)} / Cr ${formatCurrency(Number(props.row.credit) || 0)}`}
          />
          <Row label="Linked contact" value={bundle?.lineAccount?.linked_contact_name || '—'} />
          <Row label="Payment contact" value={bundle?.payment?.contact_name || '—'} />
          <Row label="JE ref type" value={props.row.reference_type || bundle?.journal?.reference_type || '—'} />
          <Row label="Pay ref type" value={bundle?.payment?.reference_type || '—'} />
        </dl>
        <Section title="Why in queue">{diag.queueReason}</Section>
        <Section title="Suggested next action">{diag.suggestedAction}</Section>
      </div>
    </UnmappedSourceDetailModal>
  );
}
