import { useEffect, useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { getAccounts, getJournalEntryForEdit, updateJournalEntryInPlace, type JournalEntryEditRow } from '../../../../api/accounts';
import {
  getTransactionDetail,
  updatePaymentTransactionInPlace,
  canEditTransaction,
  type TransactionDetail,
} from '../../../../api/transactions';
import { getPaymentAccounts } from '../../../../api/accounts';
import { CustomSelect } from '../../../common';
import { useSubmitLock } from '../../../../contexts/LoadingContext';
import { SaveBlockingOverlay } from '../../../common/SaveBlockingOverlay';
import { AttachmentFilePicker } from '../../../shared/AttachmentFilePicker';
import { AttachmentsSection } from '../../../shared/AttachmentsSection';
import { DateInputField } from '../../../shared/DateTimePicker';
import { toLocalDateString } from '../../../../utils/localDate';
import { useAttachmentPreview } from '../../../../hooks/useAttachmentPreview';
import {
  appendAccountingAttachments,
  resolveAttachmentWriteTarget,
} from '../../../../lib/appendAccountingAttachments';
import { loadMergedAttachmentsForJournalEntry } from '../../../../lib/loadMergedAttachments';
import { normalizeAttachments, type NormalizedAttachment } from '../../../../lib/normalizeAttachments';
import {
  REPLACE_ATTACHMENT_CONFIRM_MESSAGE,
  REPLACE_ATTACHMENT_INFO_MESSAGE,
  resolvePolicyReferenceType,
  usesSingleAccountingAttachmentPolicy,
} from '../../../../lib/accountingAttachmentPolicy';

interface EditTransactionSheetProps {
  open: boolean;
  companyId: string;
  branchId?: string | null;
  mode: 'payment' | 'journal';
  targetId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function EditTransactionSheet({
  open,
  companyId,
  branchId,
  mode,
  targetId,
  onClose,
  onSaved,
}: EditTransactionSheetProps) {
  const [loading, setLoading] = useState(false);
  const { run: runSave, busy: saving } = useSubmitLock();
  const [error, setError] = useState<string | null>(null);
  const [attachInfo, setAttachInfo] = useState<string | null>(null);
  const [paymentDetail, setPaymentDetail] = useState<TransactionDetail | null>(null);
  const [journalDetail, setJournalDetail] = useState<JournalEntryEditRow | null>(null);
  const [existingAttachments, setExistingAttachments] = useState<NormalizedAttachment[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [singleAttachPolicy, setSingleAttachPolicy] = useState(false);
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<Array<{ id: string; name: string }>>([]);
  const { openAttachmentPreview, AttachmentPreviewPortal } = useAttachmentPreview();
  const [form, setForm] = useState({
    date: '',
    amount: '',
    description: '',
    paymentMethod: 'cash',
    paymentAccountId: '',
    referenceNumber: '',
    debitAccountId: '',
    creditAccountId: '',
    notes: '',
  });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setAttachInfo(null);
    setPendingFiles([]);
    setSingleAttachPolicy(false);
    Promise.all([getAccounts(companyId), getPaymentAccounts(companyId)])
      .then(async ([accRes, payRes]) => {
        if (cancelled) return;
        setAccounts((accRes.data || []).map((a) => ({ id: a.id, name: a.name })));
        setPaymentAccounts((payRes.data || []).map((a) => ({ id: a.id, name: a.name })));
        if (mode === 'payment') {
          const res = await getTransactionDetail(companyId, targetId);
          if (cancelled) return;
          if (res.error || !res.data) {
            setError(res.error || 'Transaction not found.');
            return;
          }
          const lockCheck = canEditTransaction(res.data.referenceType, 'payment_row');
          if (!lockCheck.editable) {
            setError(lockCheck.reason || 'This transaction is locked.');
            return;
          }
          setPaymentDetail(res.data);
          setExistingAttachments(normalizeAttachments(res.data.attachments));
          setSingleAttachPolicy(usesSingleAccountingAttachmentPolicy(res.data.referenceType));
          setForm({
            date: res.data.paymentDate ? String(res.data.paymentDate).slice(0, 10) : '',
            amount: String(res.data.amount || ''),
            description: '',
            paymentMethod: res.data.method || 'cash',
            paymentAccountId: res.data.paymentAccountId || '',
            referenceNumber: res.data.referenceNumber || '',
            debitAccountId: '',
            creditAccountId: '',
            notes: res.data.notes || '',
          });
        } else {
          const res = await getJournalEntryForEdit(companyId, targetId);
          if (cancelled) return;
          if (res.error || !res.data) {
            setError(res.error || 'Journal entry not found.');
            return;
          }
          const lockCheck = canEditTransaction(res.data.referenceType, 'journal_entry');
          if (!lockCheck.editable) {
            setError(lockCheck.reason || 'This transaction is locked.');
            return;
          }
          setJournalDetail(res.data);
          const merged = await loadMergedAttachmentsForJournalEntry(companyId, {
            journalEntryId: res.data.id,
            rowAttachments: res.data.attachments,
            referenceType: res.data.referenceType,
            referenceId: res.data.referenceId,
            paymentId: res.data.paymentId,
          });
          if (!cancelled) {
            setExistingAttachments(merged);
            const target = await resolveAttachmentWriteTarget(companyId, {
              paymentId: res.data.paymentId,
              journalEntryId: res.data.id,
              referenceType: res.data.referenceType,
              referenceId: res.data.referenceId,
            });
            if (target && !cancelled) {
              const refType = await resolvePolicyReferenceType(
                companyId,
                target,
                res.data.referenceType,
              );
              if (!cancelled) setSingleAttachPolicy(usesSingleAccountingAttachmentPolicy(refType));
            }
          }
          setForm({
            date: res.data.entryDate || '',
            amount: String(res.data.amount || ''),
            description: res.data.description || '',
            paymentMethod: 'cash',
            paymentAccountId: '',
            referenceNumber: '',
            debitAccountId: res.data.debitAccountId || '',
            creditAccountId: res.data.creditAccountId || '',
            notes: '',
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, mode, open, targetId]);

  const canSave = useMemo(() => {
    const amount = Number(form.amount || 0);
    if (amount <= 0 || !form.date) return false;
    if (mode === 'payment') return !!form.paymentAccountId;
    return !!form.debitAccountId && !!form.creditAccountId && form.debitAccountId !== form.creditAccountId;
  }, [form.amount, form.date, form.paymentAccountId, form.debitAccountId, form.creditAccountId, mode]);

  const onSubmit = async () => {
    await runSave('Saving changes...', async () => {
      setError(null);
      setAttachInfo(null);
      if (mode === 'payment' && paymentDetail) {
        const res = await updatePaymentTransactionInPlace({
          companyId,
          paymentId: paymentDetail.paymentId,
          amount: Number(form.amount || 0),
          paymentDate: form.date,
          paymentAccountId: form.paymentAccountId,
          paymentMethod: form.paymentMethod,
          referenceNumber: form.referenceNumber || null,
          notes: form.notes || null,
        });
        if (res.error) {
          setError(res.error);
          return;
        }
      }
      if (mode === 'journal' && journalDetail) {
        const res = await updateJournalEntryInPlace({
          companyId,
          journalEntryId: journalDetail.id,
          entryDate: form.date,
          description: form.description || journalDetail.description || 'Entry update',
          debitAccountId: form.debitAccountId,
          creditAccountId: form.creditAccountId,
          amount: Number(form.amount || 0),
        });
        if (res.error) {
          setError(res.error);
          return;
        }
      }

      if (pendingFiles.length > 0) {
        if (singleAttachPolicy && existingAttachments.length > 0) {
          if (!window.confirm(REPLACE_ATTACHMENT_CONFIRM_MESSAGE)) {
            return;
          }
        }
        const target = await resolveAttachmentWriteTarget(companyId, {
          paymentId:
            mode === 'payment'
              ? paymentDetail?.paymentId
              : journalDetail?.paymentId,
          journalEntryId: mode === 'journal' ? journalDetail?.id : paymentDetail?.journalEntryId,
          referenceType:
            mode === 'payment' ? paymentDetail?.referenceType : journalDetail?.referenceType,
          referenceId:
            mode === 'payment' ? paymentDetail?.referenceId : journalDetail?.referenceId,
        });
        if (!target) {
          setError('Could not save attachments for this entry.');
          return;
        }
        const attachRes = await appendAccountingAttachments(companyId, target, pendingFiles, {
          branchId,
          referenceType:
            mode === 'payment' ? paymentDetail?.referenceType : journalDetail?.referenceType,
        });
        if (!attachRes.ok) {
          setError(attachRes.error || 'Attachment upload failed.');
          return;
        }
        if (attachRes.warning) setAttachInfo(attachRes.warning);
      }

      onSaved();
      onClose();
    });
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4"
        onClick={saving ? undefined : onClose}
      >
        <div
          className="relative w-full sm:max-w-lg bg-[#1F2937] sm:rounded-xl rounded-t-2xl border border-[#374151] max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <SaveBlockingOverlay active={saving} label="Saving changes..." />
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#374151]">
            <h3 className="text-sm font-semibold text-white">Edit Transaction</h3>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="p-2 rounded-lg hover:bg-[#374151] text-[#9CA3AF] disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading && (
              <div className="py-8 flex items-center justify-center text-[#9CA3AF]">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            )}
            {error && !loading && (
              <div className="p-3 rounded-lg bg-[#EF4444]/20 border border-[#EF4444] text-[#FCA5A5] text-sm">
                {error}
              </div>
            )}
            {attachInfo && !loading && (
              <div className="p-3 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-100 text-sm">
                {attachInfo}
              </div>
            )}
            {!loading && !error && (
              <>
                <DateInputField
                  label="Date"
                  value={form.date}
                  onChange={(v) => setForm((s) => ({ ...s, date: toLocalDateString(v) }))}
                />
                <label className="block text-xs text-[#9CA3AF]">Amount</label>
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9.]*"
                  value={form.amount}
                  onChange={(e) => setForm((s) => ({ ...s, amount: e.target.value }))}
                  className="w-full h-10 rounded bg-[#111827] border border-[#374151] text-white px-3 text-sm"
                />

                {mode === 'payment' && (
                  <>
                    <CustomSelect
                      label="Payment Account"
                      value={form.paymentAccountId}
                      onChange={(v) => setForm((s) => ({ ...s, paymentAccountId: v }))}
                      options={[
                        { value: '', label: 'Select account' },
                        ...paymentAccounts.map((a) => ({ value: a.id, label: a.name })),
                      ]}
                      disabled={saving}
                      zIndexClass="z-[100]"
                    />
                    <CustomSelect
                      label="Payment Method"
                      value={form.paymentMethod}
                      onChange={(v) => setForm((s) => ({ ...s, paymentMethod: v }))}
                      options={[
                        { value: 'cash', label: 'Cash' },
                        { value: 'bank', label: 'Bank' },
                        { value: 'card', label: 'Card' },
                        { value: 'other', label: 'Other' },
                      ]}
                      disabled={saving}
                      zIndexClass="z-[100]"
                    />
                    <label className="block text-xs text-[#9CA3AF]">Reference #</label>
                    <input
                      type="text"
                      value={form.referenceNumber}
                      onChange={(e) => setForm((s) => ({ ...s, referenceNumber: e.target.value }))}
                      className="w-full h-10 rounded bg-[#111827] border border-[#374151] text-white px-3 text-sm"
                    />
                    <label className="block text-xs text-[#9CA3AF]">Notes</label>
                    <textarea
                      rows={3}
                      value={form.notes}
                      onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
                      className="w-full rounded bg-[#111827] border border-[#374151] text-white px-3 py-2 text-sm"
                    />
                  </>
                )}

                {mode === 'journal' && (
                  <>
                    <CustomSelect
                      label="Debit Account"
                      value={form.debitAccountId}
                      onChange={(v) => setForm((s) => ({ ...s, debitAccountId: v }))}
                      options={[
                        { value: '', label: 'Select debit account' },
                        ...accounts.map((a) => ({ value: a.id, label: a.name })),
                      ]}
                      disabled={saving}
                      zIndexClass="z-[100]"
                    />
                    <CustomSelect
                      label="Credit Account"
                      value={form.creditAccountId}
                      onChange={(v) => setForm((s) => ({ ...s, creditAccountId: v }))}
                      options={[
                        { value: '', label: 'Select credit account' },
                        ...accounts.map((a) => ({ value: a.id, label: a.name })),
                      ]}
                      disabled={saving}
                      zIndexClass="z-[100]"
                    />
                    <label className="block text-xs text-[#9CA3AF]">Description</label>
                    <textarea
                      rows={3}
                      value={form.description}
                      onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                      className="w-full rounded bg-[#111827] border border-[#374151] text-white px-3 py-2 text-sm"
                    />
                  </>
                )}

                {existingAttachments.length > 0 ? (
                  <AttachmentsSection
                    title={singleAttachPolicy ? 'Current attachment' : 'Current attachments'}
                    items={existingAttachments}
                    onOpenPreview={openAttachmentPreview}
                  />
                ) : null}

                {singleAttachPolicy && existingAttachments.length > 0 ? (
                  <div className="p-3 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-100 text-sm">
                    {REPLACE_ATTACHMENT_INFO_MESSAGE}
                  </div>
                ) : null}

                <AttachmentFilePicker
                  files={pendingFiles}
                  onChange={setPendingFiles}
                  onError={setError}
                  onInfo={setAttachInfo}
                  maxFiles={singleAttachPolicy ? 1 : undefined}
                  label={singleAttachPolicy ? 'Add attachment' : 'Add attachments'}
                  description={
                    singleAttachPolicy
                      ? 'One file per receipt · saved when you tap Save Changes'
                      : 'Camera or gallery · saved when you tap Save Changes'
                  }
                />
              </>
            )}
          </div>
          <div className="p-4 border-t border-[#374151]">
            <button
              type="button"
              onClick={onSubmit}
              disabled={!canSave || saving || loading}
              className="w-full h-11 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-60 text-white font-medium"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
      {AttachmentPreviewPortal}
    </>
  );
}
