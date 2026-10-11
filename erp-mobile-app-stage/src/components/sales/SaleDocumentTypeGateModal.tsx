import { useEffect, useState } from 'react';
import { FileText, FileSpreadsheet, Scissors, ShoppingCart } from 'lucide-react';
import type { SaleDocumentStatus } from './SelectCustomer';
import { DateInputField } from '../shared/DateTimePicker';
import { localDatePlusDays } from '../../utils/localDate';

export interface SaleDocumentTypeGateModalProps {
  open: boolean;
  onPick: (status: SaleDocumentStatus, deadlineDate?: string) => void;
  onCancel: () => void;
}

/**
 * Post-branch gate: choose what kind of sale document to start.
 * Custom Order = bespoke/customization entry (lifecycle stays 'order' — stock & GL post on finalize).
 * Final = ordinary direct sale (invoice + payment now).
 */
export function SaleDocumentTypeGateModal({ open, onPick, onCancel }: SaleDocumentTypeGateModalProps) {
  const [orderExpanded, setOrderExpanded] = useState(false);
  const [deadlineDate, setDeadlineDate] = useState(localDatePlusDays(7));

  useEffect(() => {
    if (open) {
      setOrderExpanded(false);
      setDeadlineDate(localDatePlusDays(7));
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center"
      onClick={onCancel}
    >
      <div
        className="bg-[#1F2937] border-t sm:border border-[#374151] rounded-t-2xl sm:rounded-xl w-full max-w-md max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-[#374151]">
          <h3 className="font-semibold text-white">What are you creating?</h3>
          <p className="text-sm text-[#9CA3AF]">Choose the document type for this sale</p>
        </div>
        <div className="p-4 overflow-y-auto max-h-[60vh] space-y-2">
          <button
            type="button"
            onClick={() => onPick('final')}
            className="w-full flex items-center gap-3 p-4 bg-[#111827] border border-[#374151] rounded-xl text-left transition-colors hover:border-[#10B981]"
          >
            <span className="p-2 rounded-lg bg-[#10B981]/15 text-[#10B981]">
              <ShoppingCart className="w-5 h-5" />
            </span>
            <span>
              <span className="block font-medium text-white">Final Sale</span>
              <span className="block text-xs text-[#9CA3AF]">Direct product sale — invoice &amp; payment now</span>
            </span>
          </button>

          <div
            className={`bg-[#111827] border rounded-xl transition-colors ${
              orderExpanded ? 'border-[#8B5CF6]' : 'border-[#374151] hover:border-[#8B5CF6]'
            }`}
          >
            <button
              type="button"
              onClick={() => setOrderExpanded((v) => !v)}
              className="w-full flex items-center gap-3 p-4 text-left"
            >
              <span className="p-2 rounded-lg bg-[#8B5CF6]/15 text-[#8B5CF6]">
                <Scissors className="w-5 h-5" />
              </span>
              <span>
                <span className="block font-medium text-white">Custom Order</span>
                <span className="block text-xs text-[#9CA3AF]">
                  Customized / bespoke items — stock &amp; payment on finalize
                </span>
              </span>
            </button>
            {orderExpanded && (
              <div className="px-4 pb-4 space-y-3">
                <DateInputField label="Delivery Date" value={deadlineDate} onChange={setDeadlineDate} />
                <button
                  type="button"
                  onClick={() => onPick('order', deadlineDate)}
                  className="w-full py-3 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded-lg font-medium"
                >
                  Start Custom Order
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onPick('quotation')}
              className="flex items-center gap-2 p-3 bg-[#111827] border border-[#374151] rounded-xl text-left transition-colors hover:border-[#3B82F6]"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#3B82F6] shrink-0" />
              <span>
                <span className="block text-sm font-medium text-white">Quotation</span>
                <span className="block text-[10px] text-[#9CA3AF]">Price estimate</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => onPick('draft')}
              className="flex items-center gap-2 p-3 bg-[#111827] border border-[#374151] rounded-xl text-left transition-colors hover:border-[#6B7280]"
            >
              <FileText className="w-4 h-4 text-[#9CA3AF] shrink-0" />
              <span>
                <span className="block text-sm font-medium text-white">Draft</span>
                <span className="block text-[10px] text-[#9CA3AF]">Save for later</span>
              </span>
            </button>
          </div>
        </div>
        <div className="p-4 border-t border-[#374151]">
          <button
            type="button"
            onClick={onCancel}
            className="w-full py-3 bg-[#374151] hover:bg-[#4B5563] text-white rounded-lg font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
