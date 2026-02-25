import { useState } from 'react';
import { X } from 'lucide-react';
import type { RentalDetail } from '../../api/rentals';

interface RentalPickupModalProps {
  rental: RentalDetail;
  onClose: () => void;
  onConfirm: (payload: {
    actualPickupDate: string;
    notes?: string;
    documentType: string;
    documentNumber: string;
    securityDocumentImageUrl?: string | null;
    documentReceived: boolean;
    remainingPaymentConfirmed: boolean;
  }) => void;
  loading: boolean;
}

export function RentalPickupModal({ rental, onClose, onConfirm, loading }: RentalPickupModalProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [actualPickupDate, setActualPickupDate] = useState(today);
  const [documentType, setDocumentType] = useState<'cnic' | 'card' | 'other'>('cnic');
  const [documentNumber, setDocumentNumber] = useState('');
  const [securityDocumentImageUrl, setSecurityDocumentImageUrl] = useState('');
  const [documentReceived, setDocumentReceived] = useState(true);
  const [remainingPaymentConfirmed, setRemainingPaymentConfirmed] = useState(rental.dueAmount <= 0);
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    if (!documentNumber.trim()) {
      alert('Enter document number.');
      return;
    }
    if (rental.dueAmount > 0 && !remainingPaymentConfirmed) {
      alert('Confirm remaining payment or collect before marking picked up.');
      return;
    }
    onConfirm({
      actualPickupDate,
      notes: notes || undefined,
      documentType,
      documentNumber: documentNumber.trim(),
      securityDocumentImageUrl: securityDocumentImageUrl.trim() || undefined,
      documentReceived,
      remainingPaymentConfirmed,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center">
      <div className="bg-[#1F2937] rounded-t-2xl sm:rounded-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[#374151]">
          <h2 className="text-lg font-semibold text-white">Mark Picked Up</h2>
          <button onClick={onClose} className="p-2 text-[#9CA3AF] hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-sm text-[#9CA3AF]">Rental: {rental.bookingNo} · Due: Rs. {rental.dueAmount.toLocaleString()}</p>
          <div>
            <label className="block text-sm text-[#9CA3AF] mb-1">Actual pickup date</label>
            <input
              type="date"
              value={actualPickupDate}
              onChange={(e) => setActualPickupDate(e.target.value)}
              className="w-full max-w-full min-w-0 h-10 bg-[#111827] border border-[#374151] rounded-lg px-3 text-white box-border"
            />
          </div>
          <p className="text-sm font-medium text-[#E5E7EB]">Security Document Collected?</p>
          <div>
            <label className="block text-sm text-[#9CA3AF] mb-1">Document type</label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as 'cnic' | 'card' | 'other')}
              className="w-full max-w-full min-w-0 h-10 bg-[#111827] border border-[#374151] rounded-lg px-3 text-white box-border"
            >
              <option value="cnic">CNIC</option>
              <option value="card">Card</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-[#9CA3AF] mb-1">Document number</label>
            <input
              type="text"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              placeholder="e.g. 35201-1234567-1"
              className="w-full max-w-full min-w-0 h-10 bg-[#111827] border border-[#374151] rounded-lg px-3 text-white placeholder-[#6B7280] box-border"
            />
          </div>
          <div>
            <label className="block text-sm text-[#9CA3AF] mb-1">Document image URL (optional)</label>
            <input
              type="url"
              inputMode="url"
              value={securityDocumentImageUrl}
              onChange={(e) => setSecurityDocumentImageUrl(e.target.value)}
              placeholder="https://… or leave blank"
              className="w-full max-w-full min-w-0 h-10 bg-[#111827] border border-[#374151] rounded-lg px-3 text-white placeholder-[#6B7280] box-border"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={documentReceived}
              onChange={(e) => setDocumentReceived(e.target.checked)}
              className="rounded border-[#374151] bg-[#111827] text-[#3B82F6]"
            />
            <span className="text-sm text-[#E5E7EB]">Security document received from customer</span>
          </label>
          {rental.dueAmount > 0 && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={remainingPaymentConfirmed}
                onChange={(e) => setRemainingPaymentConfirmed(e.target.checked)}
                className="rounded border-[#374151] bg-[#111827] text-[#3B82F6]"
              />
              <span className="text-sm text-[#E5E7EB]">Remaining payment confirmed / collected</span>
            </label>
          )}
          <div>
            <label className="block text-sm text-[#9CA3AF] mb-1">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full h-10 bg-[#111827] border border-[#374151] rounded-lg px-3 text-white placeholder-[#6B7280]"
            />
          </div>
        </div>
        <div className="p-4 border-t border-[#374151] flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-[#374151] text-[#9CA3AF] rounded-lg font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium"
          >
            {loading ? 'Saving…' : 'Mark Picked Up'}
          </button>
        </div>
      </div>
    </div>
  );
}
