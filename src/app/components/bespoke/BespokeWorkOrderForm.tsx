import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { CalendarDatePicker } from '../ui/CalendarDatePicker';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  bespokeWorkOrderService,
  type BespokeWorkOrderStatus,
} from '@/app/services/bespokeWorkOrderService';
import { toast } from 'sonner';
import {
  type BespokePartyContact,
  formatPartyOption,
  mapCreateWorkOrderError,
  mapUpdateWorkOrderError,
} from './bespokePartyLabels';

type BespokeWorkOrderFormBaseProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
};

type BespokeWorkOrderCreateProps = BespokeWorkOrderFormBaseProps & {
  mode?: 'create';
  branchId: string;
  saleId: string;
  parentSalesItemId: string;
  instructionsSnapshot: Record<string, unknown>;
  onCreated?: () => void;
};

type BespokeWorkOrderEditProps = BespokeWorkOrderFormBaseProps & {
  mode: 'edit';
  workOrderId: string;
  workOrderNo?: string;
  initialValues: {
    partyContactId: string;
    productionCost: number;
    notes?: string | null;
    status: BespokeWorkOrderStatus;
    createdAt?: string | null;
    completedAt?: string | null;
    stockPosted?: boolean;
  };
  onSaved?: () => void;
};

export type BespokeWorkOrderFormProps = BespokeWorkOrderCreateProps | BespokeWorkOrderEditProps;

const EDIT_STATUS_OPTIONS: Array<{ value: BespokeWorkOrderStatus; label: string }> = [
  { value: 'draft', label: 'Pending' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
];

function isEditProps(props: BespokeWorkOrderFormProps): props is BespokeWorkOrderEditProps {
  return props.mode === 'edit';
}

function parseDateOnly(iso?: string | null): Date | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

export function BespokeWorkOrderForm(props: BespokeWorkOrderFormProps) {
  const { open, onOpenChange, companyId } = props;
  const isEdit = isEditProps(props);

  const [parties, setParties] = useState<BespokePartyContact[]>([]);
  const [partyContactId, setPartyContactId] = useState('');
  const [productionCost, setProductionCost] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<BespokeWorkOrderStatus>('draft');
  const [createdDate, setCreatedDate] = useState<Date | undefined>();
  const [completedDate, setCompletedDate] = useState<Date | undefined>();
  const [stockPosted, setStockPosted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cancellingStock, setCancellingStock] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [loadingParties, setLoadingParties] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (isEdit) {
      setPartyContactId(props.initialValues.partyContactId);
      setProductionCost(String(props.initialValues.productionCost ?? ''));
      setNotes(props.initialValues.notes ?? '');
      setStatus(props.initialValues.status);
      setCreatedDate(parseDateOnly(props.initialValues.createdAt));
      setCompletedDate(parseDateOnly(props.initialValues.completedAt));
      setStockPosted(Boolean(props.initialValues.stockPosted));
    } else {
      setPartyContactId('');
      setProductionCost('');
      setNotes('');
      setStatus('draft');
      setCreatedDate(undefined);
      setCompletedDate(undefined);
      setStockPosted(false);
    }
    setLoadError(null);
  }, [open, isEdit, isEdit ? props.workOrderId : props.parentSalesItemId, isEdit ? props.initialValues : null]);

  useEffect(() => {
    if (!open || !companyId) return;
    let cancelled = false;
    setLoadingParties(true);
    setLoadError(null);
    (async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, type')
        .eq('company_id', companyId)
        .in('type', ['worker', 'supplier', 'both'])
        .order('name');
      if (cancelled) return;
      if (error) {
        setLoadError(error.message);
        setParties([]);
        toast.error(`Could not load workers or suppliers: ${error.message}`);
      } else {
        setParties(
          (data ?? []).map((c) => ({
            id: c.id,
            name: c.name || 'Unnamed',
            type: String(c.type ?? 'supplier'),
          })),
        );
      }
      setLoadingParties(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, companyId]);

  const handleCancelStockPost = async () => {
    if (!isEdit) return;
    setCancellingStock(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const result = await bespokeWorkOrderService.cancelStockPost(props.workOrderId, user?.id);
      if (result.stockMovementsReversed > 0) {
        toast.success(
          `Stock cancelled: ${result.stockMovementsReversed} reversal movement${result.stockMovementsReversed === 1 ? '' : 's'}.`,
        );
      } else {
        toast.info('No stock movements to reverse.');
      }
      setStockPosted(false);
      setCancelConfirmOpen(false);
      props.onSaved?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Cancel stock failed');
    } finally {
      setCancellingStock(false);
    }
  };

  const handleSubmit = async () => {
    const cost = Number(productionCost);
    if (!partyContactId) {
      toast.error('Select a worker or supplier');
      return;
    }
    if (!Number.isFinite(cost) || cost <= 0) {
      toast.error('Enter a valid production cost');
      return;
    }
    if (isEdit && status === 'completed' && !completedDate) {
      toast.error('Select job completed date when status is Completed');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (isEdit) {
        const result = await bespokeWorkOrderService.updateWorkOrder({
          id: props.workOrderId,
          tailorContactId: partyContactId,
          productionCost: cost,
          notes,
          userId: user?.id,
          status,
          createdAt: createdDate,
          completedAt: status === 'completed' ? completedDate : null,
        });
        if (result.reopened) {
          toast.success('Work order reopened — stock reversed and journal voided.');
        } else if (result.completed) {
          if (result.stockMovementsPosted && result.stockMovementsPosted > 0) {
            toast.success('Job complete — stock posted (fabric + custom order).');
          } else {
            toast.success('Work order completed.');
          }
        } else {
          toast.success('Work order updated');
        }
        props.onSaved?.();
      } else {
        const selectedParty = parties.find((p) => p.id === partyContactId);
        await bespokeWorkOrderService.createWorkOrder({
          companyId,
          branchId: props.branchId,
          saleId: props.saleId,
          parentSalesItemId: props.parentSalesItemId,
          tailorContactId: partyContactId,
          productionCost: cost,
          instructionsSnapshot: props.instructionsSnapshot,
          notes,
          createdBy: user?.id,
          partyName: selectedParty?.name,
        });
        toast.success('Work order created');
        props.onCreated?.();
      }
      onOpenChange(false);
    } catch (e: unknown) {
      toast.error(isEdit ? mapUpdateWorkOrderError(e) : mapCreateWorkOrderError(e));
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = !saving && !loadingParties && parties.length > 0 && Boolean(partyContactId);
  const title = isEdit
    ? `Edit work order${props.workOrderNo ? ` — ${props.workOrderNo}` : ''}`
    : 'Create work order';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto">
            {isEdit && (
              <>
                <div>
                  <Label className="text-gray-300">Status</Label>
                  <Select
                    value={status}
                    onValueChange={(v) => setStatus(v as BespokeWorkOrderStatus)}
                  >
                    <SelectTrigger className="bg-gray-950 border-gray-700 mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-950 border-gray-800">
                      {EDIT_STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-gray-300">Job created</Label>
                    <div className="mt-1">
                      <CalendarDatePicker
                        value={createdDate}
                        onChange={setCreatedDate}
                        placeholder="Created date"
                        showTime={false}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-gray-300">Job completed</Label>
                    <div className={status !== 'completed' ? 'mt-1 opacity-50 pointer-events-none' : 'mt-1'}>
                      <CalendarDatePicker
                        value={completedDate}
                        onChange={setCompletedDate}
                        placeholder="Completed date"
                        showTime={false}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            <div>
              <Label className="text-gray-300">Worker or supplier</Label>
              {loadingParties ? (
                <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading workers and suppliers…
                </div>
              ) : loadError ? (
                <p className="text-xs text-red-400 mt-2">{loadError}</p>
              ) : parties.length === 0 ? (
                <p className="text-xs text-amber-400/90 mt-2">
                  No workers or suppliers found. Add them in Contacts first.
                </p>
              ) : (
                <Select value={partyContactId} onValueChange={setPartyContactId}>
                  <SelectTrigger className="bg-gray-950 border-gray-700 mt-1">
                    <SelectValue placeholder="Select worker or supplier" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-950 border-gray-800">
                    {parties.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {formatPartyOption(p)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <Label className="text-gray-300">Production cost (internal)</Label>
              <Input
                type="number"
                min={0}
                value={productionCost}
                onChange={(e) => setProductionCost(e.target.value)}
                className="bg-gray-950 border-gray-700 mt-1"
                placeholder="e.g. 25000"
                disabled={loadingParties}
              />
            </div>
            <div>
              <Label className="text-gray-300">Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="bg-gray-950 border-gray-700 mt-1"
                disabled={loadingParties}
              />
            </div>

            {isEdit && stockPosted && (
              <Button
                type="button"
                variant="outline"
                className="w-full border-red-500/40 text-red-300 hover:bg-red-500/10"
                disabled={cancellingStock || saving}
                onClick={() => setCancelConfirmOpen(true)}
              >
                {cancellingStock ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Cancel stock post
              </Button>
            )}

            {isEdit && (
              <p className="text-xs text-gray-500">
                Changing status from Completed to Pending or In progress reverses stock and voids
                the production journal. Completed jobs still update the journal in place when you
                only change cost or worker.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={!canSubmit}>
              {saving ? (isEdit ? 'Saving…' : 'Creating…') : isEdit ? 'Save changes' : 'Create work order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <AlertDialogContent className="bg-gray-900 border-gray-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel stock post?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Reverse fabric and custom-order stock movements for this job. The work order stays
              completed until you change status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-700">Keep stock</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-500"
              onClick={(e) => {
                e.preventDefault();
                void handleCancelStockPost();
              }}
            >
              {cancellingStock ? 'Reversing…' : 'Cancel stock post'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
