import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { CustomSelect } from '../common';
import { DateInputField } from '../shared/DateTimePicker';
import type { RentalDetail } from '../../api/rentals';
import { localNowDateString } from '../../utils/localDate';
import * as accountsApi from '../../api/accounts';

interface RentalReturnModalProps {
  rental: RentalDetail;
  companyId: string | null;
  onClose: () => void;
  onConfirm: (payload: {
    actualReturnDate: string;
    notes?: string;
    conditionType: string;
    damageNotes?: string;
    penaltyAmount: number;
    penaltyPaid: boolean;
    documentReturned: boolean;
    penaltyPaymentAccountId?: string | null;
  }) => void;
  loading: boolean;
}

export function RentalReturnModal({ rental, companyId, onClose, onConfirm, loading }: RentalReturnModalProps) {
  const today = localNowDateString();
  const [actualReturnDate, setActualReturnDate] = useState(today);
  const [conditionType, setConditionType] = useState('good');
  const [damageNotes, setDamageNotes] = useState('');
  const [penaltyAmount, setPenaltyAmount] = useState('');
  const [penaltyPaid, setPenaltyPaid] = useState(false);
  const [penaltyPaymentAccountId, setPenaltyPaymentAccountId] = useState<string | null>(null);
  const [paymentAccounts, setPaymentAccounts] = useState<accountsApi.AccountRow[]>([]);
  const [documentReturned, setDocumentReturned] = useState(true);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!companyId) return;
    accountsApi.getPaymentAccounts(companyId).then(({ data }) => {
      setPaymentAccounts(data || []);
      if (data?.length === 1) setPenaltyPaymentAccountId(data[0].id);
    });
  }, [companyId]);

  const penalty = parseFloat(penaltyAmount) || 0;
  const hasPenalty = conditionType !== 'good';
  const isMajorDamage = conditionType === 'major_damage';
  const finalPayable = rental.dueAmount + penalty;

  const handleSubmit = () => {
    if (!documentReturned) {
      alert('Please confirm document returned to customer.');
      return;
    }
    if (hasPenalty && !damageNotes.trim()) {
      alert('Damage notes are required when condition is not good.');
      return;
    }
    if (hasPenalty && penalty <= 0) {
      alert('Penalty amount is required when there is damage.');
      return;
    }
    if (isMajorDamage && penalty <= 0) {
      alert('Major damage requires a penalty amount.');
      return;
    }
    if (hasPenalty && penalty > 0 && !penaltyPaid) {
      alert('Please confirm penalty received.');
      return;
    }
    if (hasPenalty && penalty > 0 && penaltyPaid && !penaltyPaymentAccountId) {
      alert('Select account where penalty is received.');
      return;
    }
    if (finalPayable > 0 && !penaltyPaid && rental.dueAmount > 0) {
      alert('Clear balance (remaining rent and/or penalty) before completing return.');
      return;
    }
    onConfirm({
      actualReturnDate,
      notes: notes || undefined,
      conditionType,
      damageNotes: damageNotes || undefined,
      penaltyAmount: penalty,
      penaltyPaid,
      documentReturned,
      penaltyPaymentAccountId: hasPenalty && penalty > 0 && penaltyPaid ? penaltyPaymentAccountId ?? undefined : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center">
      <div className="bg-[#1F2937] rounded-t-2xl sm:rounded-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[#374151]">
          <h2 className="text-lg font-semibold text-white">Receive Return</h2>
          <button onClick={onClose} className="p-2 text-[#9CA3AF] hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-sm text-[#9CA3AF]">Rental: {rental.bookingNo}</p>
          <div className="bg-[#111827] border border-[#374151] rounded-lg p-3">
            <p className="text-xs text-[#9CA3AF]">Remaining rent</p>
            <p className="font-medium text-white">Rs. {rental.dueAmount.toLocaleString()}</p>
            <p className="text-xs text-[#9CA3AF] mt-2">Final payable (rent + penalty)</p>
            <p className="font-bold text-[#F59E0B]">Rs. {finalPayable.toLocaleString()}</p>
          </div>
          <DateInputField
            label="Actual return date"
            value={actualReturnDate}
            onChange={setActualReturnDate}
            accent="rental"
            required
          />
          <div>
            <CustomSelect
              label="Condition"
              value={conditionType}
              onChange={setConditionType}
              options={[
                { value: 'good', label: 'Good condition' },
                { value: 'minor_damage', label: 'Minor damage' },
                { value: 'major_damage', label: 'Major damage' },
              ]}
              zIndexClass="z-[100]"
            />
          </div>
          {conditionType !== 'good' && (
            <>
              <div>
                <label className="block text-sm text-[#9CA3AF] mb-1">Damage notes *</label>
                <input
                  type="text"
                  value={damageNotes}
                  onChange={(e) => setDamageNotes(e.target.value)}
                  placeholder="Required when condition is not good"
                  className="w-full h-10 bg-[#111827] border border-[#374151] rounded-lg px-3 text-white placeholder-[#6B7280]"
                />
              </div>
              <div>
                <label className="block text-sm text-[#9CA3AF] mb-1">Penalty amount (Rs.) {isMajorDamage ? '*' : ''}</label>
                <input
                  type="number"
                  inputMode="decimal"
                  pattern="[0-9.]*"
                  min="0"
                  step="0.01"
                  value={penaltyAmount}
                  onChange={(e) => setPenaltyAmount(e.target.value)}
                  className="w-full max-w-full min-w-0 h-10 bg-[#111827] border border-[#374151] rounded-lg px-3 text-white box-border"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={penaltyPaid}
                  onChange={(e) => setPenaltyPaid(e.target.checked)}
                  className="rounded border-[#374151] bg-[#111827] text-[#3B82F6]"
                />
                <span className="text-sm text-[#E5E7EB]">Penalty paid</span>
              </label>
              {penaltyPaid && penalty > 0 && (
                <div>
                  <CustomSelect
                    label="Penalty received into *"
                    value={penaltyPaymentAccountId ?? ''}
                    onChange={(v) => setPenaltyPaymentAccountId(v || null)}
                    options={[
                      { value: '', label: 'Select account' },
                      ...paymentAccounts.map((acc) => ({
                        value: acc.id,
                        label: `${acc.name} (${acc.code})`,
                      })),
                    ]}
                    zIndexClass="z-[100]"
                  />
                </div>
              )}
            </>
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
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={documentReturned}
              onChange={(e) => setDocumentReturned(e.target.checked)}
              className="rounded border-[#374151] bg-[#111827] text-[#3B82F6]"
            />
            <span className="text-sm text-[#E5E7EB]">Document returned to customer</span>
          </label>
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
            className="flex-1 py-2.5 bg-[#10B981] hover:bg-[#059669] disabled:opacity-50 text-white rounded-lg font-medium"
          >
            {loading ? 'Saving…' : 'Confirm Return'}
          </button>
        </div>
      </div>
    </div>
  );
}
