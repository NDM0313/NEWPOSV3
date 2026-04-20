import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { DatePicker } from '@/app/components/ui/DatePicker';
import { Button } from '@/app/components/ui/button';
import { Checkbox } from '@/app/components/ui/checkbox';
import { useSupabase } from '@/app/context/SupabaseContext';
import type { RentalUI } from '@/app/context/RentalContext';
import { cn } from '@/app/components/ui/utils';
import { UnifiedPaymentDialog } from '@/app/components/shared/UnifiedPaymentDialog';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { Landmark, FileWarning, CheckCircle2, Clock } from 'lucide-react';

export interface ReturnConfirmPayload {
  actualReturnDate: string;
  notes?: string;
  conditionType: 'good' | 'minor_damage' | 'major_damage';
  damageNotes?: string;
  penaltyAmount: number;
  penaltyPaid: boolean;
  penaltyPaymentMethod?: string;
  documentReturned: boolean;
  /** Penalty row + JE were recorded via UnifiedPaymentDialog before confirm */
  penaltyPaymentPreRecorded?: boolean;
}

interface ReturnModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rental: RentalUI | null;
  /** Document info from pickup (document_type, document_number) */
  documentInfo?: { documentType?: string; documentNumber?: string };
  onConfirm: (rentalId: string, payload: ReturnConfirmPayload) => Promise<void>;
}

const CONDITION_OPTIONS = [
  { value: 'good' as const, label: 'Good Condition' },
  { value: 'minor_damage' as const, label: 'Minor Damage' },
  { value: 'major_damage' as const, label: 'Major Damage' },
];

export const ReturnModal = ({ open, onOpenChange, rental, documentInfo, onConfirm }: ReturnModalProps) => {
  const { user } = useSupabase();
  const { formatCurrency } = useFormatCurrency();
  const [returnDate, setReturnDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [conditionType, setConditionType] = useState<'good' | 'minor_damage' | 'major_damage'>('good');
  const [damageNotes, setDamageNotes] = useState('');
  const [penaltyAmount, setPenaltyAmount] = useState('');
  /** true = bill customer (AR / collect later); false = collect now via Unified payment */
  const [penaltyCreditMode, setPenaltyCreditMode] = useState(true);
  const [penaltyPaymentPreRecorded, setPenaltyPaymentPreRecorded] = useState(false);
  const [unifiedPaymentOpen, setUnifiedPaymentOpen] = useState(false);
  const [documentReturned, setDocumentReturned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Radix outer Dialog often fires onOpenChange(false) when a nested modal closes — block briefly after unified closes */
  const blockParentDismissRef = useRef(false);
  const lastUnifiedPaymentOpenRef = useRef(false);

  const penalty = parseFloat(penaltyAmount) || 0;
  const hasPenalty = conditionType !== 'good';

  useEffect(() => {
    if (conditionType === 'good') {
      setPenaltyAmount('');
      setPenaltyCreditMode(true);
      setPenaltyPaymentPreRecorded(false);
    }
  }, [conditionType]);

  useEffect(() => {
    setPenaltyPaymentPreRecorded(false);
  }, [penaltyAmount, penaltyCreditMode]);

  useEffect(() => {
    const prev = lastUnifiedPaymentOpenRef.current;
    lastUnifiedPaymentOpenRef.current = unifiedPaymentOpen;
    if (unifiedPaymentOpen) {
      blockParentDismissRef.current = true;
      return;
    }
    if (prev) {
      blockParentDismissRef.current = true;
      const t = window.setTimeout(() => {
        blockParentDismissRef.current = false;
      }, 450);
      return () => window.clearTimeout(t);
    }
  }, [unifiedPaymentOpen]);

  const resetForm = () => {
    setError(null);
    setReturnDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setConditionType('good');
    setDamageNotes('');
    setPenaltyAmount('');
    setPenaltyCreditMode(true);
    setPenaltyPaymentPreRecorded(false);
    setUnifiedPaymentOpen(false);
    lastUnifiedPaymentOpenRef.current = false;
    blockParentDismissRef.current = false;
    setDocumentReturned(false);
  };

  const handleConfirm = async () => {
    if (!rental) return;
    if (hasPenalty && !damageNotes.trim()) {
      setError('Damage notes are required when condition is not good');
      return;
    }
    if (hasPenalty && penalty <= 0) {
      setError('Penalty amount is required when there is damage');
      return;
    }
    if (hasPenalty && penalty > 0 && !penaltyCreditMode && !penaltyPaymentPreRecorded) {
      setError('Record the penalty payment in the payment dialog first, or choose “Bill customer”.');
      return;
    }
    if (!documentReturned) {
      setError('Please confirm document returned to customer');
      return;
    }

    setError(null);
    setSaving(true);
    try {
      await onConfirm(rental.id, {
        actualReturnDate: returnDate,
        notes: notes.trim() || undefined,
        conditionType,
        damageNotes: hasPenalty ? damageNotes.trim() : undefined,
        penaltyAmount: penalty,
        penaltyPaid: hasPenalty ? !penaltyCreditMode : true,
        penaltyPaymentMethod: undefined,
        documentReturned,
        penaltyPaymentPreRecorded: hasPenalty && !penaltyCreditMode ? penaltyPaymentPreRecorded : undefined,
      });
      onOpenChange(false);
      resetForm();
    } catch (e: any) {
      setError(e?.message || 'Failed to process return');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && (unifiedPaymentOpen || blockParentDismissRef.current)) {
      return;
    }
    if (!next) resetForm();
    onOpenChange(next);
  };

  const returnedBy = user?.email || (user?.user_metadata as any)?.full_name || 'Current user';
  const docTypeLabel = documentInfo?.documentType
    ? ({ cnic: 'CNIC', passport: 'Passport', driving_license: 'Driving License', other: 'Other' } as Record<string, string>)[
        documentInfo.documentType
      ] || documentInfo.documentType
    : '—';

  const needsPenaltyCollection = hasPenalty && penalty > 0 && !penaltyCreditMode;
  const penaltyFlowOk = !needsPenaltyCollection || penaltyPaymentPreRecorded;

  const canConfirm =
    documentReturned &&
    (conditionType === 'good' ? true : penalty > 0 && damageNotes.trim().length > 0 && penaltyFlowOk);

  const penaltyNotesDefault = `Rental return — ${conditionType.replace(/_/g, ' ')}${damageNotes.trim() ? ` — ${damageNotes.trim().slice(0, 120)}` : ''}`;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="bg-gray-900 border-gray-700 max-w-[950px] p-0 overflow-hidden sm:max-w-[min(calc(100vw-2rem),950px)]"
          onPointerDownOutside={(e) => {
            if (unifiedPaymentOpen || blockParentDismissRef.current) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (unifiedPaymentOpen || blockParentDismissRef.current) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (unifiedPaymentOpen) {
              e.preventDefault();
              setUnifiedPaymentOpen(false);
            }
          }}
        >
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-800">
            <DialogTitle className="text-white text-xl">Confirm Return</DialogTitle>
            <DialogDescription className="text-gray-400">
              Process return for rental {rental?.rentalNo}
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-[450px]">
            <div className="flex-[6] overflow-y-auto p-6 space-y-6">
              <div className="rounded-lg border border-gray-700 p-4 bg-gray-800/30">
                <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Rental Info</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Rental #</span>
                    <p className="font-mono text-pink-400">{rental?.rentalNo}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Customer</span>
                    <p className="text-white">{rental?.customerName}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Product(s)</span>
                    <p className="text-white font-medium">{rental?.items?.map((i) => i.productName).join(', ') || '—'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Pickup Date</span>
                    <p className="text-white">{rental?.startDate}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Expected Return</span>
                    <p className="text-white">{rental?.expectedReturnDate}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-gray-700 p-4 bg-gray-800/30">
                <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Item Inspection</h4>
                <div className="space-y-3">
                  <Label className="text-gray-400 text-sm">Condition</Label>
                  <div className="flex flex-wrap gap-4">
                    {CONDITION_OPTIONS.map((opt) => (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="condition"
                          checked={conditionType === opt.value}
                          onChange={() => setConditionType(opt.value)}
                          className="w-4 h-4 text-green-500 border-gray-600 bg-gray-800 focus:ring-green-500"
                        />
                        <span className="text-sm text-gray-300">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                  {hasPenalty && (
                    <>
                      <div>
                        <Label className="text-gray-400 text-sm">Damage Notes *</Label>
                        <textarea
                          value={damageNotes}
                          onChange={(e) => setDamageNotes(e.target.value)}
                          placeholder="Describe the damage..."
                          rows={2}
                          className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white text-sm resize-none"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-400 text-sm">Penalty Amount *</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={penaltyAmount}
                          onChange={(e) => setPenaltyAmount(e.target.value)}
                          placeholder="0"
                          className="mt-1 bg-gray-800 border-gray-700 text-white"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {hasPenalty && penalty > 0 && (
                <div className="rounded-xl border border-gray-700/80 overflow-hidden bg-gradient-to-b from-gray-800/40 to-gray-900/40">
                  <div className="px-4 py-3 border-b border-gray-700/80 flex items-center gap-2 bg-gray-800/50">
                    <FileWarning className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <h4 className="text-sm font-semibold text-white">Penalty settlement</h4>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Use the same payment screen as elsewhere (bank / cash accounts). Or bill the customer on AR.
                      </p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-[10px] uppercase tracking-wider text-gray-500">Amount</p>
                      <p className="text-lg font-bold text-red-400 tabular-nums">{formatCurrency(penalty)}</p>
                    </div>
                  </div>

                  <div className="p-4 grid gap-3 sm:grid-cols-2">
                    {/* div (not button) so inner <Button> is valid DOM — avoids nested <button> + Radix quirks */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setPenaltyCreditMode(false)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setPenaltyCreditMode(false);
                        }
                      }}
                      className={cn(
                        'rounded-lg border p-4 text-left transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-pink-500/40',
                        !penaltyCreditMode
                          ? 'border-pink-500/60 bg-pink-500/10 ring-1 ring-pink-500/30'
                          : 'border-gray-700 bg-gray-800/20 hover:border-gray-600 hover:bg-gray-800/40'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            'mt-0.5 h-4 w-4 rounded-full border-2 shrink-0',
                            !penaltyCreditMode ? 'border-pink-400 bg-pink-500' : 'border-gray-500'
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-white flex items-center gap-2">
                            <Landmark className="w-4 h-4 text-pink-400 shrink-0" />
                            Receive payment now
                          </p>
                          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                            Opens the unified payment dialog: choose account (bank, cash, wallet), amount, date and attachments.
                          </p>
                          {!penaltyCreditMode && (
                            <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                              <Button
                                type="button"
                                className="w-full bg-pink-600 hover:bg-pink-500 text-white"
                                onClick={() => setUnifiedPaymentOpen(true)}
                              >
                                Open payment…
                              </Button>
                              {penaltyPaymentPreRecorded ? (
                                <p className="flex items-center gap-1.5 text-xs text-green-400">
                                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                  Payment recorded — you can confirm return.
                                </p>
                              ) : (
                                <p className="flex items-center gap-1.5 text-xs text-amber-400/90">
                                  <Clock className="w-3.5 h-3.5 shrink-0" />
                                  Required before confirming return.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setPenaltyCreditMode(true);
                        setPenaltyPaymentPreRecorded(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setPenaltyCreditMode(true);
                          setPenaltyPaymentPreRecorded(false);
                        }
                      }}
                      className={cn(
                        'rounded-lg border p-4 text-left transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-500/30',
                        penaltyCreditMode
                          ? 'border-amber-500/50 bg-amber-500/5 ring-1 ring-amber-500/20'
                          : 'border-gray-700 bg-gray-800/20 hover:border-gray-600 hover:bg-gray-800/40'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            'mt-0.5 h-4 w-4 rounded-full border-2 shrink-0',
                            penaltyCreditMode ? 'border-amber-400 bg-amber-500/80' : 'border-gray-500'
                          )}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white">Bill customer (credit)</p>
                          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                            Add {formatCurrency(penalty)} to customer outstanding — collect later from customer ledger or next payment.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex-[4] border-l border-gray-800 p-6 bg-gray-900/50 flex flex-col space-y-6">
              <div className="rounded-lg border border-gray-700 p-4 bg-gray-800/30">
                <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Guarantee Document</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500">Document Type</span>
                    <span className="text-white text-right">{docTypeLabel}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500">Document Number</span>
                    <span className="text-white font-mono text-right">{documentInfo?.documentNumber || '—'}</span>
                  </div>
                  <p className="text-xs text-green-400 mt-2">Document received at pickup: Yes</p>
                </div>
                <label className="mt-4 flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={documentReturned}
                    onCheckedChange={(v) => setDocumentReturned(!!v)}
                    className="border-gray-600 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                  />
                  <span className="text-sm text-gray-300">Document returned to customer</span>
                </label>
              </div>

              <div className="rounded-lg border border-gray-700 p-4 bg-gray-800/30 flex-1">
                <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Final Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500">Total Rental Amount</span>
                    <span className="text-white tabular-nums">{formatCurrency(rental?.totalAmount ?? 0)}</span>
                  </div>
                  {penalty > 0 && (
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-500">Penalty</span>
                      <span className="text-red-400 tabular-nums">{formatCurrency(penalty)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-gray-700 gap-2">
                    <span className="text-gray-500">Rental + penalty (info)</span>
                    <span className="text-white font-semibold tabular-nums">
                      {formatCurrency((rental?.totalAmount ?? 0) + penalty)}
                    </span>
                  </div>
                </div>
                <div className="mt-4">
                  <Label className="text-gray-400 text-sm">Return Date</Label>
                  <DatePicker
                    value={returnDate}
                    onChange={(v) => setReturnDate(v)}
                    placeholder="Return date"
                    className="mt-1 w-full"
                  />
                </div>
                <div className="mt-3">
                  <Label className="text-gray-400 text-sm">Returned By</Label>
                  <p className="mt-1 text-sm text-gray-300">{returnedBy}</p>
                </div>
                <div className="mt-3">
                  <Label className="text-gray-400 text-sm">Notes</Label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any notes..."
                    rows={2}
                    className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white text-sm resize-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {error && <p className="px-6 text-sm text-red-400">{error}</p>}

          <DialogFooter className="px-6 py-4 border-t border-gray-800">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="bg-gray-800 text-white border-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={saving || !canConfirm}
              className="bg-green-600 hover:bg-green-500 text-white"
              aria-busy={saving}
            >
              {saving ? 'Saving…' : 'Confirm Return'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {rental && (
        <UnifiedPaymentDialog
          isOpen={unifiedPaymentOpen}
          onClose={() => setUnifiedPaymentOpen(false)}
          context="rental"
          entityName={rental.customerName}
          entityId={rental.customerId || rental.id}
          outstandingAmount={penalty}
          totalAmount={penalty}
          paidAmount={0}
          referenceNo={rental.rentalNo}
          referenceId={rental.id}
          rentalPaymentKind="penalty"
          defaultPaymentNotes={penaltyNotesDefault}
          onSuccess={() => {
            setPenaltyPaymentPreRecorded(true);
            setUnifiedPaymentOpen(false);
          }}
        />
      )}
    </>
  );
};
