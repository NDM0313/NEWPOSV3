import React from 'react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { getDeveloperRepairAction } from '@/app/lib/developerRepairActions';
import {
  buildTraceRepairCandidateLabel,
  type TraceRepairCandidateLabel,
} from '@/app/lib/traceRepairCandidateLabels';
import type { TraceRepairCandidate } from '@/app/lib/transactionTraceRepairDiagnostics';
import type { RepairQueueItem } from '@/app/lib/developerRepairTypes';

interface Props {
  candidate: TraceRepairCandidate;
  sourceTab: string;
  onSendToQueue: (item: Omit<RepairQueueItem, 'queueId'>) => void;
}

function riskBadge(level: string) {
  if (level === 'high') return <Badge className="bg-red-900/40 text-red-300 border-red-800">high</Badge>;
  if (level === 'medium') return <Badge className="bg-amber-900/40 text-amber-300 border-amber-800">medium</Badge>;
  return <Badge className="bg-emerald-900/40 text-emerald-300 border-emerald-800">low</Badge>;
}

function LabelRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2 py-0.5">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-300 break-all">{value}</span>
    </div>
  );
}

export function TraceRepairCandidateCard({ candidate, sourceTab, onSendToQueue }: Props) {
  const action = candidate.queueItem
    ? getDeveloperRepairAction(candidate.queueItem.actionId)
    : undefined;

  const label: TraceRepairCandidateLabel | null = buildTraceRepairCandidateLabel(candidate, action ?? null);

  if (!label || !candidate.queueItem) return null;

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-200">{label.title}</span>
        {riskBadge(label.riskLevel)}
        <span className="text-[10px] font-mono text-violet-400/90">{label.actionId}</span>
      </div>

      <LabelRow label="Why detected" value={label.detectedReason} />
      <LabelRow label="Target table" value={label.targetTable} />
      <LabelRow label="Target id" value={<span className="font-mono text-[11px]">{label.targetId}</span>} />
      <LabelRow
        label="Will change"
        value={
          <ul className="list-disc ml-4 space-y-0.5">
            {label.whatWillChange.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        }
      />
      <LabelRow
        label="Never changes"
        value={
          <ul className="list-disc ml-4 space-y-0.5 text-gray-400">
            {label.whatWillNeverChange.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        }
      />

      <div className="pt-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7"
          onClick={() => onSendToQueue({ ...candidate.queueItem!, sourceTab })}
        >
          Send to queue
        </Button>
      </div>
    </div>
  );
}

export function TraceRepairCandidatesPanel({
  candidates,
  sourceTab,
  onSendToQueue,
}: {
  candidates: TraceRepairCandidate[];
  sourceTab: string;
  onSendToQueue: (item: Omit<RepairQueueItem, 'queueId'>) => void;
}) {
  const queueable = candidates.filter((c) => c.canQueue && c.queueItem);

  if (queueable.length === 0) {
    return (
      <p className="text-xs text-gray-500">
        {candidates[0]?.reason || 'No safe repair available'}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {queueable.map((c) => (
        <TraceRepairCandidateCard
          key={`${c.queueItem!.actionId}-${JSON.stringify(c.queueItem!.params)}`}
          candidate={c}
          sourceTab={sourceTab}
          onSendToQueue={onSendToQueue}
        />
      ))}
    </div>
  );
}
