import { useState } from 'react';
import { Package, Edit2 } from 'lucide-react';
import type { PackingDetails } from './PackingEntryModal';
import { PackingEntryModal } from './PackingEntryModal';

interface PackingInputButtonProps {
  packingDetails?: PackingDetails;
  onPackingChange: (details: PackingDetails) => void;
  productName?: string;
  className?: string;
}

export function PackingInputButton({
  packingDetails,
  onPackingChange,
  productName,
  className = '',
}: PackingInputButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const hasDetails = packingDetails && (packingDetails.total_meters ?? 0) > 0;

  const formatVal = (v: number) => (v % 1 === 0 ? String(v) : v.toFixed(1));

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all min-w-0 ${className} ${
          hasDetails
            ? 'bg-[#3B82F6]/20 border border-[#3B82F6]/50 text-[#93C5FD]'
            : 'border border-[#374151] text-[#9CA3AF] hover:border-[#3B82F6]/50 hover:bg-[#3B82F6]/10'
        }`}
      >
        {hasDetails ? (
          <>
            <Package className="w-4 h-4" />
            <span className="font-bold">{formatVal(packingDetails!.total_boxes ?? 0)}</span>
            <span className="opacity-70">Box</span>
            <span className="opacity-40">/</span>
            <span className="font-bold">{formatVal(packingDetails!.total_pieces ?? 0)}</span>
            <span className="opacity-70">Pc</span>
            <span className="opacity-40">/</span>
            <span className="font-bold text-[#10B981]">{(packingDetails!.total_meters ?? 0).toFixed(1)}</span>
            <span className="opacity-70">M</span>
            <Edit2 className="w-3 h-3 opacity-50" />
          </>
        ) : (
          <>
            <Package className="w-4 h-4" />
            Add Packing
          </>
        )}
      </button>

      <PackingEntryModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onSave={onPackingChange}
        initialData={packingDetails}
        productName={productName}
      />
    </>
  );
}
