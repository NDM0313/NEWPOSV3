import { useState, useEffect } from 'react';
import { X, Upload, DollarSign, Loader2 } from 'lucide-react';
import { CustomSelect } from '../common';
import { MediaSourcePicker } from '../shared/MediaSourcePicker';
import { uploadRentalPickupDoc } from '../../api/rentalPickupDocs';
import type { MarkRentalPickedUpPayload, RentalDetail } from '../../api/rentals';
import { localNowDateString } from '../../utils/localDate';
import { formatDate } from '../accounts/reports/_shared/format';

const DOCUMENT_TYPES = [
  { value: 'cnic', label: 'CNIC' },
  { value: 'passport', label: 'Passport' },
  { value: 'driving_license', label: 'Driving License' },
  { value: 'other', label: 'Other' },
] as const;

interface RentalPickupModalProps {
  rental: RentalDetail;
  companyId: string;
  onClose: () => void;
  onConfirm: (payload: MarkRentalPickedUpPayload) => void | Promise<void>;
  onAddPayment?: () => void;
  loading: boolean;
}

function PhotoSlot({
  label,
  file,
  onPick,
  onClear,
  disabled,
}: {
  label: string;
  file: File | null;
  onPick: (files: File[]) => void;
  onClear: () => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-[#9CA3AF] mb-1">{label}</p>
      {file ? (
        <div className="bg-[#111827] border border-[#374151] rounded-xl p-3 flex items-center justify-between gap-2">
          <span className="text-xs text-[#10B981] truncate flex-1">{file.name}</span>
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="text-xs text-red-400 shrink-0"
          >
            Remove
          </button>
        </div>
      ) : (
        <MediaSourcePicker accept="image/*" onFiles={onPick} disabled={disabled}>
          {(open) => (
            <button
              type="button"
              onClick={open}
              disabled={disabled}
              className="w-full border-2 border-dashed border-[#374151] rounded-xl p-3 flex flex-col items-center gap-1 text-[#9CA3AF] hover:border-[#8B5CF6] disabled:opacity-50"
            >
              <Upload className="w-5 h-5" />
              <span className="text-xs">Camera or upload</span>
            </button>
          )}
        </MediaSourcePicker>
      )}
    </div>
  );
}

export function RentalPickupModal({
  rental,
  companyId,
  onClose,
  onConfirm,
  onAddPayment,
  loading,
}: RentalPickupModalProps) {
  const today = localNowDateString();
  const [actualPickupDate, setActualPickupDate] = useState(today);
  const [documentType, setDocumentType] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [documentExpiry, setDocumentExpiry] = useState('');
  const [documentReceived, setDocumentReceived] = useState(false);
  const [remainingPaymentConfirmed, setRemainingPaymentConfirmed] = useState(rental.dueAmount <= 0);
  const [notes, setNotes] = useState('');
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [customerPhotoFile, setCustomerPhotoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (rental.dueAmount <= 0) setRemainingPaymentConfirmed(true);
  }, [rental.dueAmount]);

  const remainingDue = rental.dueAmount;
  const canSubmitBase =
    Boolean(documentType) &&
    documentNumber.trim().length > 0 &&
    documentReceived &&
    Boolean(actualPickupDate) &&
    actualPickupDate >= rental.pickupDate.slice(0, 10);
  const canSubmit =
    canSubmitBase && (remainingDue <= 0 || remainingPaymentConfirmed) && !loading && !uploading;

  const handleSubmit = async () => {
    if (!canSubmitBase) {
      setError('Document type, number, and “document received” are required.');
      return;
    }
    if (remainingDue > 0 && !remainingPaymentConfirmed) {
      setError('Confirm remaining payment or collect payment first.');
      return;
    }
    if (actualPickupDate < rental.pickupDate.slice(0, 10)) {
      setError('Pickup date cannot be before the booking pickup date.');
      return;
    }
    if (documentExpiry && documentExpiry < actualPickupDate) {
      setError('Document expiry cannot be before pickup date.');
      return;
    }

    setError('');
    setUploading(true);
    try {
      let documentFrontImage: string | undefined;
      let documentBackImage: string | undefined;
      let customerPhoto: string | undefined;
      if (frontFile) {
        documentFrontImage = await uploadRentalPickupDoc(companyId, rental.id, 'front', frontFile);
      }
      if (backFile) {
        documentBackImage = await uploadRentalPickupDoc(companyId, rental.id, 'back', backFile);
      }
      if (customerPhotoFile) {
        customerPhoto = await uploadRentalPickupDoc(companyId, rental.id, 'customer', customerPhotoFile);
      }
      await onConfirm({
        actualPickupDate,
        notes: notes.trim() || undefined,
        documentType,
        documentNumber: documentNumber.trim(),
        documentExpiry: documentExpiry || undefined,
        documentReceived,
        remainingPaymentConfirmed,
        documentFrontImage,
        documentBackImage,
        customerPhoto,
      });
    } catch (e) {
      setError((e as Error).message || 'Upload or save failed.');
    } finally {
      setUploading(false);
    }
  };

  const itemSummary =
    rental.items.map((i) => `${i.productName}${i.quantity > 1 ? ` × ${i.quantity}` : ''}`).join(', ') || '—';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center">
      <div className="bg-[#1F2937] rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[#374151] sticky top-0 bg-[#1F2937] z-10">
          <div>
            <h2 className="text-lg font-semibold text-white">Confirm Pickup</h2>
            <p className="text-xs text-[#9CA3AF]">{rental.bookingNo}</p>
          </div>
          <button onClick={onClose} className="p-2 text-[#9CA3AF] hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/40 rounded-xl text-red-300 text-sm">{error}</div>
          )}

          <div className="bg-[#111827] border border-[#374151] rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide">Rental info</p>
            <p className="text-sm text-white font-medium">{rental.customerName}</p>
            <p className="text-xs text-[#9CA3AF]">{itemSummary}</p>
            <p className="text-xs text-[#6B7280]">
              Return: {formatDate(rental.returnDate)}
            </p>
          </div>

          <div className="bg-[#111827] border border-[#374151] rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide">Payment settlement</p>
            <div className="flex justify-between text-sm">
              <span className="text-[#9CA3AF]">Total</span>
              <span className="text-white">Rs. {rental.totalAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#9CA3AF]">Advance paid</span>
              <span className="text-white">Rs. {rental.paidAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#9CA3AF]">Remaining</span>
              <span className={remainingDue > 0 ? 'text-[#F59E0B] font-semibold' : 'text-[#9CA3AF]'}>
                Rs. {remainingDue.toLocaleString()}
              </span>
            </div>
            {remainingDue > 0 && onAddPayment && (
              <button
                type="button"
                onClick={onAddPayment}
                className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium"
              >
                <DollarSign className="w-4 h-4" />
                Add Payment (Rs. {remainingDue.toLocaleString()})
              </button>
            )}
            {remainingDue > 0 && (
              <label className="flex items-center gap-2 cursor-pointer pt-2">
                <input
                  type="checkbox"
                  checked={remainingPaymentConfirmed}
                  onChange={(e) => setRemainingPaymentConfirmed(e.target.checked)}
                  className="rounded border-[#374151] bg-[#111827] text-[#3B82F6]"
                />
                <span className="text-sm text-[#E5E7EB]">Remaining payment confirmed / collected</span>
              </label>
            )}
          </div>

          <div className="bg-[#111827] border border-[#374151] rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide">Guarantee document</p>
            <CustomSelect
              label="Document type *"
              value={documentType}
              onChange={setDocumentType}
              options={[{ value: '', label: 'Select type' }, ...DOCUMENT_TYPES.map((t) => ({ value: t.value, label: t.label }))]}
              zIndexClass="z-[100]"
            />
            <div>
              <label className="block text-sm text-[#9CA3AF] mb-1">Security document number *</label>
              <input
                type="text"
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                placeholder="CNIC / Passport number"
                className="w-full h-10 bg-[#1F2937] border border-[#374151] rounded-lg px-3 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-[#9CA3AF] mb-1">Document expiry (optional)</label>
              <input
                type="date"
                value={documentExpiry}
                onChange={(e) => setDocumentExpiry(e.target.value)}
                className="w-full h-10 bg-[#1F2937] border border-[#374151] rounded-lg px-3 text-white"
              />
            </div>
            <div className="grid grid-cols-1 gap-3">
              <PhotoSlot label="Document front (optional)" file={frontFile} onPick={(f) => setFrontFile(f[0] ?? null)} onClear={() => setFrontFile(null)} disabled={loading || uploading} />
              <PhotoSlot label="Document back (optional)" file={backFile} onPick={(f) => setBackFile(f[0] ?? null)} onClear={() => setBackFile(null)} disabled={loading || uploading} />
              <PhotoSlot label="Customer live photo (optional)" file={customerPhotoFile} onPick={(f) => setCustomerPhotoFile(f[0] ?? null)} onClear={() => setCustomerPhotoFile(null)} disabled={loading || uploading} />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={documentReceived}
                onChange={(e) => setDocumentReceived(e.target.checked)}
                className="rounded border-[#374151] bg-[#111827] text-amber-500"
              />
              <span className="text-sm text-[#E5E7EB]">Document physically received</span>
            </label>
          </div>

          <div className="bg-[#111827] border border-[#374151] rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide">Pickup details</p>
            <div>
              <label className="block text-sm text-[#9CA3AF] mb-1">Actual pickup date *</label>
              <input
                type="date"
                value={actualPickupDate}
                min={rental.pickupDate.slice(0, 10)}
                onChange={(e) => setActualPickupDate(e.target.value)}
                className="w-full h-10 bg-[#1F2937] border border-[#374151] rounded-lg px-3 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-[#9CA3AF] mb-1">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about pickup or document…"
                rows={3}
                className="w-full bg-[#1F2937] border border-[#374151] rounded-lg px-3 py-2 text-white text-sm resize-none"
              />
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-[#374151] flex gap-2 sticky bottom-0 bg-[#1F2937]">
          <button
            type="button"
            onClick={onClose}
            disabled={loading || uploading}
            className="flex-1 py-2.5 border border-[#374151] text-[#9CA3AF] rounded-lg font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg font-medium flex items-center justify-center gap-2"
          >
            {(loading || uploading) && <Loader2 className="w-4 h-4 animate-spin" />}
            {uploading ? 'Uploading…' : loading ? 'Saving…' : 'Confirm Pickup'}
          </button>
        </div>
      </div>
    </div>
  );
}
