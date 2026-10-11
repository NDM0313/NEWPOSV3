import {
  parseSendNotes,
  parseReceiveNotes,
  parsePaymentRemarks,
  displayNotesWithoutWorkflowPrefixes,
  formatIsoDateShort,
} from '../../lib/studioWorkflowNotes';
import { parseExtraStageDisplayName } from '../../lib/studioExtraStageNotes';

export interface StudioStageTimelineProps {
  stageName: string;
  stageType: string;
  notes?: string | null;
  assignedAt?: string | null;
  sentDate?: string | null;
  receivedDate?: string | null;
  completedDate?: string | null;
  expectedCost?: number;
  workerCost?: number;
  customerCharge?: number;
  ledgerPaid?: number;
  ledgerDue?: number;
}

export function StudioStageTimeline({
  stageName,
  stageType,
  notes,
  assignedAt,
  sentDate,
  receivedDate,
  completedDate,
  expectedCost = 0,
  workerCost = 0,
  customerCharge = 0,
  ledgerPaid = 0,
  ledgerDue = 0,
}: StudioStageTimelineProps) {
  const displayName =
    parseExtraStageDisplayName(notes, stageType) ?? stageName;
  const sendNote = parseSendNotes(notes);
  const receiveNote = parseReceiveNotes(notes);
  const paymentNote = parsePaymentRemarks(notes);
  const otherNotes = displayNotesWithoutWorkflowPrefixes(notes);

  return (
    <div className="space-y-3 text-sm">
      <div>
        <p className="text-white font-medium">{displayName}</p>
        <p className="text-xs text-[#9CA3AF] capitalize">{stageType.replace(/_/g, ' ')}</p>
      </div>

      <div className="space-y-2 border-t border-[#374151] pt-2">
        <TimelineRow label="Assigned" date={assignedAt} />
        <TimelineRow label="Sent to worker" date={sentDate} note={sendNote} />
        <TimelineRow label="Received" date={receivedDate} note={receiveNote} />
        <TimelineRow label="Completed" date={completedDate} />
      </div>

      <div className="space-y-1.5 border-t border-[#374151] pt-2">
        <MoneyRow label="Expected worker cost" value={expectedCost} />
        <MoneyRow label="Worker cost (recorded)" value={workerCost} />
        <MoneyRow label="Customer charge" value={customerCharge} accent />
        {(ledgerPaid > 0 || ledgerDue > 0) && (
          <>
            <MoneyRow label="Paid to worker" value={ledgerPaid} />
            <MoneyRow label="Due to worker" value={ledgerDue} />
          </>
        )}
      </div>

      {paymentNote ? (
        <div className="border-t border-[#374151] pt-2">
          <p className="text-xs text-[#9CA3AF] mb-0.5">Payment remarks</p>
          <p className="text-xs text-[#E5E7EB] whitespace-pre-wrap">{paymentNote}</p>
        </div>
      ) : null}
      {otherNotes ? (
        <div className="border-t border-[#374151] pt-2">
          <p className="text-xs text-[#9CA3AF] mb-0.5">Other notes</p>
          <p className="text-xs text-[#E5E7EB] whitespace-pre-wrap">{otherNotes}</p>
        </div>
      ) : null}
    </div>
  );
}

function TimelineRow({
  label,
  date,
  note,
}: {
  label: string;
  date?: string | null;
  note?: string | null;
}) {
  return (
    <div>
      <div className="flex justify-between gap-2">
        <span className="text-[#9CA3AF] text-xs">{label}</span>
        <span className="text-white text-xs tabular-nums">{formatIsoDateShort(date ?? undefined)}</span>
      </div>
      {note ? (
        <p className="text-xs text-[#D1D5DB] mt-0.5 pl-2 border-l-2 border-[#8B5CF6]/50 whitespace-pre-wrap">
          {note}
        </p>
      ) : null}
    </div>
  );
}

function MoneyRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-[#9CA3AF] text-xs">{label}</span>
      <span className={`text-xs tabular-nums font-medium ${accent ? 'text-[#10B981]' : 'text-white'}`}>
        Rs. {value.toLocaleString()}
      </span>
    </div>
  );
}
