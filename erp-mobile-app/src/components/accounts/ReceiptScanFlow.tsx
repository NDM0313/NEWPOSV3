import { useState } from 'react';
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowLeftRight,
  BookOpen,
  Loader2,
  Receipt,
  ScanText,
  Truck,
  Upload,
  Users,
  Wrench,
} from 'lucide-react';
import { MAX_FILE_SIZE_BYTES, ACCEPT_TYPES } from '../../api/paymentAttachments';
import { prepareAttachmentFilesForUpload } from '../../utils/imageCompression';
import { MediaSourcePicker } from '../shared/MediaSourcePicker';
import { ReceiptOcrReviewSheet } from '../shared/ReceiptOcrReviewSheet';
import { useReceiptOcrAfterAttach } from '../../hooks/useReceiptOcrAfterAttach';
import { isImageFile } from '../../lib/ocr/receiptOcrTypes';
import type { ReceiptOcrDraft } from '../../lib/ocr/receiptOcrTypes';
import {
  type ReceiptOcrRouteKind,
  type ReceiptOcrRouteSeed,
  emptyReceiptOcrRouteSeed,
} from '../../lib/ocr/receiptOcrRouteSeed';
import { applyReceiptOcrDraft } from '../../lib/ocr/applyReceiptOcrDraft';

export interface ReceiptScanFlowProps {
  onBack: () => void;
  onRouted: (payload: { kind: ReceiptOcrRouteKind; seed: ReceiptOcrRouteSeed }) => void;
}

type Step = 'capture' | 'type';

const TYPE_OPTIONS: {
  kind: ReceiptOcrRouteKind;
  label: string;
  color: string;
  icon: typeof BookOpen;
}[] = [
  { kind: 'client-payment', label: 'Client Payment', color: 'from-[#3B82F6] to-[#2563EB]', icon: ArrowDownLeft },
  { kind: 'supplier-payment', label: 'Supplier Payment', color: 'from-[#F59E0B] to-[#D97706]', icon: Users },
  { kind: 'worker-payment', label: 'Worker Payment', color: 'from-[#10B981] to-[#059669]', icon: Wrench },
  { kind: 'courier-payment', label: 'Courier Payment', color: 'from-[#6366F1] to-[#4F46E5]', icon: Truck },
  { kind: 'expense-entry', label: 'Expense Entry', color: 'from-[#EF4444] to-[#DC2626]', icon: Receipt },
  { kind: 'account-transfer', label: 'Account Transfer', color: 'from-[#3B82F6] to-[#2563EB]', icon: ArrowLeftRight },
  { kind: 'general-entry', label: 'General Entry', color: 'from-[#8B5CF6] to-[#7C3AED]', icon: BookOpen },
];

function draftToSeed(draft: ReceiptOcrDraft | null, files: File[]): ReceiptOcrRouteSeed {
  const base = emptyReceiptOcrRouteSeed();
  base.attachmentFiles = files;
  if (!draft) return base;
  const patch = applyReceiptOcrDraft(draft);
  if (patch.amount != null) base.amount = patch.amount;
  if (patch.date) base.date = patch.date;
  if (patch.time) base.time = patch.time;
  if (patch.reference) base.reference = patch.reference;
  if (patch.notes) base.notes = patch.notes;
  if (patch.supplierHint) base.supplierHint = patch.supplierHint;
  if (!base.supplierHint && draft.supplierHint) base.supplierHint = draft.supplierHint;
  return base;
}

export function ReceiptScanFlow({ onBack, onRouted }: ReceiptScanFlowProps) {
  const [step, setStep] = useState<Step>('capture');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [confirmedDraft, setConfirmedDraft] = useState<ReceiptOcrDraft | null>(null);
  const [selectedKind, setSelectedKind] = useState<ReceiptOcrRouteKind | null>(null);

  const ocr = useReceiptOcrAfterAttach({
    enabled: true,
    onApply: () => {
      /* Confirm handled below via custom onConfirm */
    },
  });

  const processFiles = async (picked: File[]) => {
    if (!picked.length) return;
    setError(null);
    setIsProcessing(true);
    try {
      const images = picked.filter(isImageFile);
      if (!images.length) {
        setError('OCR needs a PNG or JPG screenshot. PDFs can be attached later inside the transaction.');
        return;
      }
      const { files: processed, skippedMessages } = await prepareAttachmentFilesForUpload(
        images.slice(0, 1),
        MAX_FILE_SIZE_BYTES
      );
      skippedMessages.forEach((msg) => setError(msg));
      if (!processed.length) return;
      setFiles(processed);
      setConfirmedDraft(null);
      ocr.rememberImageFromFiles(processed);
      void ocr.startOcrForFiles(processed);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOcrConfirm = (draft: ReceiptOcrDraft) => {
    setConfirmedDraft(draft);
    ocr.handleSkip();
    setStep('type');
  };

  const handleOcrSkip = () => {
    ocr.handleSkip();
    if (files.length > 0) setStep('type');
  };

  const handleContinue = () => {
    if (!selectedKind) return;
    const seed = draftToSeed(confirmedDraft, files);
    onRouted({ kind: selectedKind, seed });
  };

  return (
    <div className="min-h-screen pb-40 bg-[#111827]">
      <div className="bg-gradient-to-br from-[#0EA5E9] to-[#0284C7] p-4 sticky top-0 z-10 flow-screen-header">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (step === 'type') setStep('capture');
              else onBack();
            }}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-white flex items-center gap-2">
              <ScanText className="w-5 h-5 shrink-0" />
              Scan Receipt
            </h1>
            <p className="text-xs text-white/80">
              {step === 'capture'
                ? 'Screenshot first — then choose transaction type'
                : 'Pick where this receipt should go'}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/40 text-sm text-[#FCA5A5]">
            {error}
          </div>
        )}

        {step === 'capture' && (
          <>
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 space-y-3">
              <p className="text-sm text-[#D1D5DB]">
                Take or upload a bank receipt screenshot. You will edit amount, date, and reference before
                choosing Client / Supplier / Transfer / etc.
              </p>
              <MediaSourcePicker
                accept={ACCEPT_TYPES}
                multiple={false}
                disabled={isProcessing}
                sheetTitle="Scan receipt"
                onFiles={(picked) => void processFiles(picked)}
                onError={(msg) => setError(msg)}
              >
                {(open) => (
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={open}
                    className="w-full border border-dashed border-[#374151] rounded-lg p-6 text-center text-[#6B7280] text-sm hover:border-[#0EA5E9] hover:bg-[#0EA5E9]/10 transition-colors flex flex-col items-center gap-2 disabled:opacity-60"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-6 h-6 animate-spin text-[#0EA5E9]" />
                        <span>Compressing…</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-6 h-6 text-[#0EA5E9]" />
                        <span className="font-medium text-white">Camera or gallery</span>
                        <span className="text-xs">PNG / JPG up to 10MB</span>
                      </>
                    )}
                  </button>
                )}
              </MediaSourcePicker>
              {files.length > 0 && (
                <p className="text-xs text-[#9CA3AF] truncate">Attached: {files[0].name}</p>
              )}
            </div>

            {files.length > 0 && !ocr.sheetOpen && (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => void ocr.rescanLastImage()}
                  className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#0284C7]"
                >
                  Open OCR review
                </button>
                <button
                  type="button"
                  onClick={() => setStep('type')}
                  className="w-full py-3 rounded-xl font-medium text-[#D1D5DB] bg-[#374151]"
                >
                  Skip OCR — choose type only
                </button>
              </div>
            )}
          </>
        )}

        {step === 'type' && (
          <>
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-3 text-sm text-[#9CA3AF]">
              {confirmedDraft?.amount != null || confirmedDraft?.reference || confirmedDraft?.date ? (
                <p>
                  OCR:{' '}
                  {confirmedDraft.amount != null ? `Rs. ${confirmedDraft.amount.toLocaleString()}` : '—'}
                  {confirmedDraft.date ? ` · ${confirmedDraft.date}` : ''}
                  {confirmedDraft.reference ? ` · Ref ${confirmedDraft.reference}` : ''}
                </p>
              ) : (
                <p>No OCR fields applied — you can fill amounts inside the transaction.</p>
              )}
              {files.length > 0 && <p className="text-xs mt-1">Receipt image will carry into the form.</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {TYPE_OPTIONS.map(({ kind, label, color, icon: Icon }) => {
                const selected = selectedKind === kind;
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setSelectedKind(kind)}
                    className={`bg-gradient-to-br ${color} hover:opacity-95 rounded-xl p-4 transition-all active:scale-95 flex flex-col items-center gap-2 min-h-[96px] shadow-md shadow-black/20 ${
                      selected ? 'ring-2 ring-white ring-offset-2 ring-offset-[#111827]' : ''
                    }`}
                  >
                    <Icon className="w-6 h-6 text-white" />
                    <span className="text-xs font-semibold text-white text-center leading-tight">{label}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              disabled={!selectedKind}
              onClick={handleContinue}
              className="w-full py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-[#10B981] to-[#059669] disabled:opacity-50"
            >
              Continue to transaction
            </button>
          </>
        )}
      </div>

      <ReceiptOcrReviewSheet
        open={ocr.sheetOpen}
        loading={ocr.loading}
        draft={ocr.draft}
        onChangeDraft={ocr.setDraft}
        onConfirm={handleOcrConfirm}
        onSkip={handleOcrSkip}
      />
    </div>
  );
}
