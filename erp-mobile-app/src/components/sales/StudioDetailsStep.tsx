import { useState } from 'react';
import { ArrowLeft, Calendar, FileText, Tag } from 'lucide-react';

export interface StudioDetailsData {
  orderDate: string;
  deadlineDate: string;
  /** Required replica / studio outfit product name (persisted as studio_productions.design_name). */
  studioProductName: string;
  productionNotes: string;
}

function formatDateForInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function today(): string {
  return formatDateForInput(new Date());
}

function todayPlus7(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return formatDateForInput(d);
}

interface StudioDetailsStepProps {
  onBack: () => void;
  initialData: StudioDetailsData;
  onNext: (data: StudioDetailsData) => void;
}

export function StudioDetailsStep({ onBack, initialData, onNext }: StudioDetailsStepProps) {
  const [orderDate, setOrderDate] = useState(initialData.orderDate || today());
  const [deadlineDate, setDeadlineDate] = useState(initialData.deadlineDate || todayPlus7());
  const [studioProductName, setStudioProductName] = useState(initialData.studioProductName || '');
  const [productionNotes, setProductionNotes] = useState(initialData.productionNotes || '');

  const handleNext = () => {
    const name = studioProductName.trim();
    if (!name) {
      alert('Enter studio product name (replica / outfit title).');
      return;
    }
    onNext({ orderDate, deadlineDate, studioProductName: name, productionNotes });
  };

  return (
    <div className="min-h-screen bg-[#111827] pb-32">
      <div className="bg-[#1F2937] border-b border-[#374151] px-4 py-3 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-white">Studio Details</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <p className="text-sm text-[#9CA3AF]">Order date, deadline, studio product name (required), then optional notes.</p>

        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#9CA3AF] mb-2">Order Date</label>
            <div className="flex items-center gap-2 bg-[#111827] border border-[#374151] rounded-lg px-3 py-2.5">
              <Calendar className="w-5 h-5 text-[#6B7280]" />
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="flex-1 bg-transparent text-white text-sm outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#9CA3AF] mb-2">Deadline Date</label>
            <div className="flex items-center gap-2 bg-[#111827] border border-[#374151] rounded-lg px-3 py-2.5">
              <Calendar className="w-5 h-5 text-[#6B7280]" />
              <input
                type="date"
                value={deadlineDate}
                onChange={(e) => setDeadlineDate(e.target.value)}
                className="flex-1 bg-transparent text-white text-sm outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#F9FAFB] mb-2">
              Studio product name <span className="text-red-400">*</span>
            </label>
            <div className="flex items-start gap-2 bg-[#111827] border border-[#374151] rounded-lg px-3 py-2.5">
              <Tag className="w-5 h-5 text-[#8B5CF6] flex-shrink-0 mt-0.5" />
              <input
                type="text"
                value={studioProductName}
                onChange={(e) => setStudioProductName(e.target.value)}
                placeholder="Replica / outfit title for this studio order"
                className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-[#6B7280]"
              />
            </div>
            <p className="text-xs text-[#6B7280] mt-1">Saved as the design name on production (same as Studio detail).</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#9CA3AF] mb-2">Production notes (optional)</label>
            <div className="flex items-center gap-2 bg-[#111827] border border-[#374151] rounded-lg px-3 py-2.5">
              <FileText className="w-5 h-5 text-[#6B7280] flex-shrink-0" />
              <textarea
                value={productionNotes}
                onChange={(e) => setProductionNotes(e.target.value)}
                placeholder="e.g. heavy embroidery, special finish..."
                rows={3}
                className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-[#6B7280] resize-none"
              />
            </div>
          </div>
        </div>

        <button
          onClick={handleNext}
          className="w-full h-12 bg-[#3B82F6] hover:bg-[#2563EB] rounded-lg font-medium text-white transition-colors active:scale-[0.98]"
        >
          Next → Invoice Summary
        </button>
      </div>
    </div>
  );
}
