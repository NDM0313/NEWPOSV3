import React from 'react';
import { Wrench } from 'lucide-react';
import { ActionableRepairCard } from '@/app/components/accounting/ar-ap-repair/ActionableRepairCard';
import {
  classifyOrphanArReversalDefect,
  type ActionableRepairButton,
  type ActionableRepairClassification,
} from '@/app/lib/actionableRepairClassifier';
import { KNOWN_ORPHAN_AR_DEFECTS } from '@/app/lib/glCorrectionDraftRepair';

interface Props {
  readOnly?: boolean;
  onAction: (button: ActionableRepairButton, classification: ActionableRepairClassification) => void;
}

/** Known GL correction candidates (JE-0161 class) — dry-run actionable, apply blocked. */
export function KnownGlCorrectionSection({ readOnly, onAction }: Props) {
  const defects = KNOWN_ORPHAN_AR_DEFECTS.map(classifyOrphanArReversalDefect);

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-950/10 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Wrench className="w-5 h-5 text-amber-400" />
        <div>
          <h3 className="font-semibold text-amber-100">Known GL correction candidates</h3>
          <p className="text-xs text-gray-400">
            Orphan party AR from wrong-account sale reversals. Dry-run preview available; apply requires migration RPC.
          </p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {defects.map((c) => (
          <ActionableRepairCard key={c.queueItem?.params.defectId as string} classification={c} readOnly={readOnly} onAction={onAction} />
        ))}
      </div>
    </div>
  );
}
