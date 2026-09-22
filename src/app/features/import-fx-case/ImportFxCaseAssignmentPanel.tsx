/**
 * W2.1 Import FX Case assignment panel — operational only; never posts journals.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { SearchableSelect } from '@/app/components/ui/searchable-select';
import { toast } from 'sonner';
import { userService } from '@/app/services/userService';
import {
  completeImportFxCaseAssignment,
  updateImportFxCaseAssignment,
  type ImportFxCase,
  type ImportFxCaseEvent,
} from '@/app/services/importFxCaseService';
import {
  IMPORT_FX_ASSIGNMENT_PRIORITIES,
  IMPORT_FX_ASSIGNMENT_STATUSES,
  formatUserOption,
  isAssignmentOverdue,
  type ImportFxAssignmentPriority,
  type ImportFxAssignmentStatus,
} from '@/app/lib/importFxCaseW21Helpers';
import {
  createExclusiveBusyGuard,
  matchesPlanningSearch,
} from '@/app/lib/importFxCaseWorkspaceView';

type Props = {
  companyId: string;
  caseRow: ImportFxCase | null;
  events: ImportFxCaseEvent[];
  readOnly: boolean;
  currentUserId?: string | null;
  onUpdated: () => Promise<void> | void;
};

export const ImportFxCaseAssignmentPanel: React.FC<Props> = ({
  companyId,
  caseRow,
  events,
  readOnly,
  currentUserId,
  onUpdated,
}) => {
  const [userOptions, setUserOptions] = useState<
    { id: string; name: string; searchText: string }[]
  >([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [ownerId, setOwnerId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [actionRequired, setActionRequired] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [priority, setPriority] = useState<ImportFxAssignmentPriority | ''>('NORMAL');
  const [status, setStatus] = useState<ImportFxAssignmentStatus | ''>('OPEN');
  const [reminderAt, setReminderAt] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const busyGuard = useMemo(() => createExclusiveBusyGuard(), []);

  useEffect(() => {
    if (!caseRow) return;
    setOwnerId(caseRow.case_owner_user_id || '');
    setAssigneeId(caseRow.assigned_to_user_id || '');
    setActionRequired(caseRow.current_action_required || '');
    setDueAt(caseRow.assignment_due_at ? caseRow.assignment_due_at.slice(0, 16) : '');
    setPriority((caseRow.assignment_priority as ImportFxAssignmentPriority) || 'NORMAL');
    setStatus((caseRow.assignment_status as ImportFxAssignmentStatus) || 'OPEN');
    setReminderAt(caseRow.reminder_at ? caseRow.reminder_at.slice(0, 16) : '');
    setNotes(caseRow.assignment_notes || '');
  }, [caseRow?.id, caseRow?.assignment_updated_at]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingUsers(true);
      try {
        const users = await userService.getAllUsers(companyId);
        if (cancelled) return;
        setUserOptions(users.map((u) => formatUserOption(u)));
      } catch {
        if (!cancelled) setUserOptions([]);
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const assignmentEvents = events.filter(
    (e) =>
      e.event_type === 'ASSIGNMENT_UPDATED' || e.event_type === 'ASSIGNMENT_COMPLETED'
  );

  const overdue = isAssignmentOverdue({
    dueAt: caseRow?.assignment_due_at,
    status: caseRow?.assignment_status,
  });

  const save = async () => {
    if (!caseRow || readOnly) return;
    if (!busyGuard.tryStart()) return;
    setBusy(true);
    try {
      const result = await updateImportFxCaseAssignment({
        companyId,
        caseId: caseRow.id,
        caseOwnerUserId: ownerId || null,
        assignedToUserId: assigneeId || null,
        clearAssignee: !assigneeId,
        clearOwner: !ownerId,
        currentActionRequired: actionRequired || null,
        assignmentDueAt: dueAt ? new Date(dueAt).toISOString() : null,
        assignmentPriority: priority || null,
        assignmentStatus: status || null,
        reminderAt: reminderAt ? new Date(reminderAt).toISOString() : null,
        assignmentNotes: notes || null,
        updatedBy: currentUserId ?? null,
        clientOperationId:
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : undefined,
      });
      if (
        result.accountingStatus !== (caseRow.accounting_status || 'NOT_POSTED') &&
        result.accountingStatus !== 'NOT_POSTED'
      ) {
        toast.error('Unexpected accounting status change from assignment RPC');
      }
      toast.success('Assignment saved (not financially posted)');
      await onUpdated();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Assignment save failed');
    } finally {
      busyGuard.end();
      setBusy(false);
    }
  };

  const markDone = async () => {
    if (!caseRow || readOnly) return;
    if (!busyGuard.tryStart()) return;
    setBusy(true);
    try {
      await completeImportFxCaseAssignment({
        companyId,
        caseId: caseRow.id,
        updatedBy: currentUserId ?? null,
        notes: notes || null,
      });
      toast.success('Assignment marked done (not financially posted)');
      await onUpdated();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Complete assignment failed');
    } finally {
      busyGuard.end();
      setBusy(false);
    }
  };

  if (!caseRow) {
    return (
      <div className="rounded-lg border border-border p-3 text-xs text-muted-foreground">
        Select or create a case to manage assignment.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">Task assignment</p>
          <p className="text-[11px] text-muted-foreground">
            Operational follow-up only — separate from FX stage and accounting status. Not
            financially posted.
          </p>
        </div>
        {overdue && (
          <span className="text-[11px] font-medium text-red-500 border border-red-500/40 rounded px-2 py-0.5">
            Overdue
          </span>
        )}
      </div>

      <div className="rounded-md bg-muted/40 px-2 py-1.5 text-[11px] text-muted-foreground space-y-0.5">
        <div>
          Case: <span className="text-foreground">{caseRow.operational_status}</span>
        </div>
        <div>
          Accounting:{' '}
          <span className="text-foreground">{caseRow.accounting_status || 'NOT_POSTED'}</span>
        </div>
        <div>
          Task:{' '}
          <span className="text-foreground">{caseRow.assignment_status || '—'}</span>
          {caseRow.current_action_required ? ` · ${caseRow.current_action_required}` : ''}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1 min-w-0">
          <Label>Case Owner</Label>
          <SearchableSelect
            value={ownerId}
            onValueChange={setOwnerId}
            options={userOptions}
            placeholder={loadingUsers ? 'Loading…' : 'Select owner'}
            searchPlaceholder="Name, email, role…"
            disabled={readOnly || busy}
            filterFn={matchesPlanningSearch}
            emptyText={loadingUsers ? 'Loading users…' : 'No users found'}
          />
        </div>
        <div className="space-y-1 min-w-0">
          <Label>Assigned To</Label>
          <SearchableSelect
            value={assigneeId}
            onValueChange={setAssigneeId}
            options={userOptions}
            placeholder={loadingUsers ? 'Loading…' : 'Select assignee'}
            searchPlaceholder="Name, email, role…"
            disabled={readOnly || busy}
            filterFn={matchesPlanningSearch}
            emptyText={loadingUsers ? 'Loading users…' : 'No users found'}
          />
        </div>
        <div className="space-y-1 min-w-0 sm:col-span-2">
          <Label>Current Action Required</Label>
          <Input
            value={actionRequired}
            onChange={(e) => setActionRequired(e.target.value)}
            disabled={readOnly || busy}
            placeholder="e.g. Obtain agent USD transfer reference"
          />
        </div>
        <div className="space-y-1 min-w-0">
          <Label>Due Date</Label>
          <Input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            disabled={readOnly || busy}
          />
        </div>
        <div className="space-y-1 min-w-0">
          <Label>Reminder</Label>
          <Input
            type="datetime-local"
            value={reminderAt}
            onChange={(e) => setReminderAt(e.target.value)}
            disabled={readOnly || busy}
          />
        </div>
        <div className="space-y-1 min-w-0">
          <Label>Priority</Label>
          <select
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={priority}
            onChange={(e) => setPriority(e.target.value as ImportFxAssignmentPriority | '')}
            disabled={readOnly || busy}
          >
            {IMPORT_FX_ASSIGNMENT_PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1 min-w-0">
          <Label>Assignment Status</Label>
          <select
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as ImportFxAssignmentStatus | '')}
            disabled={readOnly || busy}
          >
            {IMPORT_FX_ASSIGNMENT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1 min-w-0 sm:col-span-2">
          <Label>Assignment Notes</Label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={readOnly || busy}
          />
        </div>
      </div>

      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void save()} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save Assignment
          </Button>
          <Button size="sm" variant="secondary" onClick={() => void markDone()} disabled={busy}>
            Mark Done
          </Button>
        </div>
      )}

      <div>
        <p className="text-[11px] font-medium text-muted-foreground mb-1">Assignment timeline</p>
        <ul className="space-y-1 max-h-32 overflow-y-auto">
          {assignmentEvents.slice(0, 8).map((e) => (
            <li
              key={e.id}
              className="text-[11px] text-muted-foreground border-b border-border/40 pb-1"
            >
              <span className="text-foreground">{e.event_type}</span>
              {e.posts_journal ? ' · journal claimed' : ' · not financially posted'}
              {e.created_at ? ` · ${new Date(e.created_at).toLocaleString()}` : ''}
            </li>
          ))}
          {assignmentEvents.length === 0 && (
            <li className="text-[11px] text-muted-foreground">No assignment events yet</li>
          )}
        </ul>
      </div>
    </div>
  );
};
