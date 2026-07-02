import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Label } from '@/app/components/ui/label';
import { Input } from '@/app/components/ui/input';
import type { ArApFixStatus } from '@/app/services/arApReconciliationCenterService';

const FIX_STATUS_OPTIONS: ArApFixStatus[] = [
  'new',
  'reviewed',
  'ready_to_post',
  'ready_to_relink',
  'ready_to_reverse_repost',
  'resolved',
];

export type StatusChangeIntent =
  | { kind: 'set'; status: ArApFixStatus }
  | { kind: 'mark_reviewed' }
  | { kind: 'mark_resolved' }
  | { kind: 'send_repair_queue' };

export function StatusChangeModal(props: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  intent: StatusChangeIntent | null;
  currentStatus: ArApFixStatus;
  rowStillInQueue?: boolean;
  onConfirm: (note: string, effectiveStatus: ArApFixStatus) => void | Promise<void>;
  readOnly?: boolean;
}) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pickedStatus, setPickedStatus] = useState<ArApFixStatus>(props.currentStatus);

  useEffect(() => {
    if (!props.open) return;
    if (props.intent?.kind === 'set') setPickedStatus(props.intent.status);
    else setPickedStatus(props.currentStatus);
  }, [props.open, props.currentStatus, props.intent]);

  const effectiveStatus = (): ArApFixStatus => {
    if (!props.intent) return pickedStatus;
    if (props.intent.kind === 'mark_resolved') {
      if (props.rowStillInQueue) return 'reviewed';
      return 'resolved';
    }
    if (props.intent.kind === 'mark_reviewed') return 'reviewed';
    if (props.intent.kind === 'send_repair_queue') return 'ready_to_reverse_repost';
    if (props.intent.kind === 'set') return pickedStatus;
    return props.intent.status;
  };

  const resolvedBlocked = props.intent?.kind === 'mark_resolved' && props.rowStillInQueue;

  const handleConfirm = async () => {
    if (props.readOnly) return;
    const trimmed = note.trim();
    if (trimmed.length < 3) return;
    setSubmitting(true);
    try {
      await props.onConfirm(trimmed, effectiveStatus());
      setNote('');
      props.onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={props.open}
      onOpenChange={(o) => {
        if (!o) setNote('');
        props.onOpenChange(o);
      }}
    >
      <DialogContent className="bg-gray-950 border-gray-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
          {props.description && <DialogDescription className="text-gray-400">{props.description}</DialogDescription>}
        </DialogHeader>
        {resolvedBlocked && (
          <p className="text-amber-300 text-xs rounded border border-amber-500/30 bg-amber-950/20 p-2">
            Row still appears in the SQL queue view. Status will be saved as <strong>reviewed</strong> (manual review), not
            resolved.
          </p>
        )}
        <div className="space-y-2">
          {props.intent?.kind === 'set' && (
            <div className="space-y-1">
              <Label className="text-gray-400 text-xs">New status</Label>
              <select
                value={pickedStatus}
                disabled={props.readOnly}
                onChange={(e) => setPickedStatus(e.target.value as ArApFixStatus)}
                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200"
              >
                {FIX_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
          )}
          <Label className="text-gray-400 text-xs">Reason / note (required, min 3 characters)</Label>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why this status change?"
            className="bg-gray-900 border-gray-700"
            disabled={props.readOnly}
          />
          <p className="text-gray-600 text-[10px]">
            New status: <span className="font-mono text-gray-400">{effectiveStatus().replace(/_/g, ' ')}</span>
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" className="border-gray-700" onClick={() => props.onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-blue-600 hover:bg-blue-500"
            disabled={props.readOnly || submitting || note.trim().length < 3}
            onClick={() => void handleConfirm()}
          >
            Confirm status change
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
