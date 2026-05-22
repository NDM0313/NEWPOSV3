import {
  parseSendNotes,
  parseReceiveNotes,
  parsePaymentRemarks,
  displayNotesWithoutWorkflowPrefixes,
  formatIsoDateShort,
} from '@/app/lib/studioWorkflowNotes';
import { parseExtraStageDisplayName } from '@/app/lib/studioExtraStageNotes';

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
  const displayName = parseExtraStageDisplayName(notes, stageType) ?? stageName;
  const sendNote = parseSendNotes(notes);
  const receiveNote = parseReceiveNotes(notes);
  const paymentNote = parsePaymentRemarks(notes);
  const otherNotes = displayNotesWithoutWorkflowPrefixes(notes);

  return (
    <div className="space-y-3 text-sm">
      <div>
        <p className="text-white font-medium">{displayName}</p>
        <p className="text-xs text-gray-400 capitalize">{stageType.replace(/_/g, ' ')}</p>
      </div>
      <div className="space-y-2 border-t border-gray-700 pt-2">
        <Row label="Assigned" date={assignedAt} />
        <Row label="Sent to worker" date={sentDate} note={sendNote} />
        <Row label="Received" date={receivedDate} note={receiveNote} />
        <Row label="Completed" date={completedDate} />
      </div>
      <div className="space-y-1.5 border-t border-gray-700 pt-2">
        <Money label="Expected worker cost" value={expectedCost} />
        <Money label="Worker cost (recorded)" value={workerCost} />
        <Money label="Customer charge" value={customerCharge} accent />
        {(ledgerPaid > 0 || ledgerDue > 0) && (
          <>
            <Money label="Paid to worker" value={ledgerPaid} />
            <Money label="Due to worker" value={ledgerDue} />
          </>
        )}
      </div>
      {paymentNote && (
        <div className="border-t border-gray-700 pt-2">
          <p className="text-xs text-gray-400 mb-0.5">Payment remarks</p>
          <p className="text-xs text-gray-200 whitespace-pre-wrap">{paymentNote}</p>
        </div>
      )}
      {otherNotes && (
        <div className="border-t border-gray-700 pt-2">
          <p className="text-xs text-gray-400 mb-0.5">Other notes</p>
          <p className="text-xs text-gray-200 whitespace-pre-wrap">{otherNotes}</p>
        </div>
      )}
    </div>
  );
}

function Row({ label, date, note }: { label: string; date?: string | null; note?: string | null }) {
  return (
    <div>
      <div className="flex justify-between gap-2">
        <span className="text-gray-400 text-xs">{label}</span>
        <span className="text-white text-xs">{formatIsoDateShort(date ?? undefined)}</span>
      </div>
      {note && <p className="text-xs text-gray-300 mt-0.5 pl-2 border-l-2 border-purple-500/50 whitespace-pre-wrap">{note}</p>}
    </div>
  );
}

function Money({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-gray-400 text-xs">{label}</span>
      <span className={`text-xs font-medium tabular-nums ${accent ? 'text-green-400' : 'text-white'}`}>
        Rs. {value.toLocaleString()}
      </span>
    </div>
  );
}
