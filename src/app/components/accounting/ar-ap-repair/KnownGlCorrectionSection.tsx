import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Wrench } from 'lucide-react';
import { ActionableRepairCard } from '@/app/components/accounting/ar-ap-repair/ActionableRepairCard';
import { Badge } from '@/app/components/ui/badge';
import {
  classifyOrphanArReversalDefect,
  type ActionableRepairButton,
  type ActionableRepairClassification,
} from '@/app/lib/actionableRepairClassifier';
import { isOrphanDefectAlreadyApplied } from '@/app/lib/arControlOrphanRepair';
import { KNOWN_ORPHAN_AR_DEFECTS } from '@/app/lib/glCorrectionDraftRepair';
import { supabase } from '@/lib/supabase';

interface Props {
  companyId: string | null;
  readOnly?: boolean;
  canApplyGlRepair?: boolean;
  onAction: (button: ActionableRepairButton, classification: ActionableRepairClassification) => void;
  onApplied?: () => void;
}

/** Known GL correction candidates (JE-0161 class) — dry-run actionable; hides when already applied. */
export function KnownGlCorrectionSection({ companyId, readOnly, canApplyGlRepair, onAction }: Props) {
  const defects = KNOWN_ORPHAN_AR_DEFECTS.map(classifyOrphanArReversalDefect);
  const [appliedByDefect, setAppliedByDefect] = useState<Record<string, boolean>>({});
  const [appliedEntryNo, setAppliedEntryNo] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!companyId) {
      setAppliedByDefect({});
      setAppliedEntryNo({});
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const applied: Record<string, boolean> = {};
      const entryNos: Record<string, string | null> = {};
      await Promise.all(
        KNOWN_ORPHAN_AR_DEFECTS.map(async (d) => {
          const isApplied = await isOrphanDefectAlreadyApplied(companyId, d.defectId);
          applied[d.defectId] = isApplied;
          if (isApplied) {
            const fp =
              d.defectId === 'hq-sl-0003-orphan-ar'
                ? 'developer_repair:gl_correction:hq-sl-0003-orphan-ar'
                : `developer_repair:gl_correction:${d.defectId}`;
            const { data } = await supabase
              .from('journal_entries')
              .select('entry_no')
              .eq('company_id', companyId)
              .eq('action_fingerprint', fp)
              .eq('is_void', false)
              .maybeSingle();
            entryNos[d.defectId] = (data as { entry_no?: string } | null)?.entry_no ?? null;
          }
        })
      );
      if (!cancelled) {
        setAppliedByDefect(applied);
        setAppliedEntryNo(entryNos);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const visibleDefects = defects.filter((c) => {
    const defectId = String(c.queueItem?.params.defectId || '');
    return !appliedByDefect[defectId];
  });

  const appliedCards = KNOWN_ORPHAN_AR_DEFECTS.filter((d) => appliedByDefect[d.defectId]);

  if (!loading && visibleDefects.length === 0 && appliedCards.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-950/10 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Wrench className="w-5 h-5 text-amber-400" />
        <div>
          <h3 className="font-semibold text-amber-100">Known GL correction candidates</h3>
          <p className="text-xs text-muted-foreground">
            Orphan party AR from wrong-account sale reversals. Dry-run = preview only; click Apply GL Correction + phrase
            to post JE.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
        </div>
      ) : null}

      {appliedCards.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {appliedCards.map((d) => (
            <div
              key={d.defectId}
              className="rounded-lg border border-emerald-700/40 bg-emerald-950/20 p-3 flex gap-2 items-start"
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-sm space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-emerald-100">Applied — {d.saleInvoiceNo}</span>
                  <Badge variant="outline" className="border-emerald-600 text-emerald-300 text-[10px]">
                    {appliedEntryNo[d.defectId] || 'correction JE active'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  GL correction already posted for this defect. No further action needed.
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {visibleDefects.length > 0 ? (
        <>
          {!canApplyGlRepair ? (
            <p className="text-[11px] text-amber-300/90">
              Apply blocked — deploy migration{' '}
              <code className="text-amber-200">20260618140000_hybrid_repair_gl_correction_targets.sql</code> on database.
            </p>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            {visibleDefects.map((c) => (
              <ActionableRepairCard
                key={c.queueItem?.params.defectId as string}
                classification={c}
                readOnly={readOnly}
                onAction={onAction}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
