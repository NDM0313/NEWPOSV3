import React, { useState } from 'react';
import { Package, Edit2 } from 'lucide-react';
import { Button } from "../ui/button";
import { cn } from "../ui/utils";
import { PackingEntryModal, PackingDetails } from './PackingEntryModal';

interface PackingInputButtonProps {
  packingDetails?: PackingDetails;
  onPackingChange: (details: PackingDetails) => void;
  productName?: string;
  className?: string;
}

export const PackingInputButton = ({
  packingDetails,
  onPackingChange,
  productName,
  className
}: PackingInputButtonProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const hasDetails = packingDetails && packingDetails.total_meters > 0;

  return (
    <>
      <Button
        type="button"
        variant={hasDetails ? "default" : "outline"}
        size="sm"
        onClick={() => setIsModalOpen(true)}
        className={cn(
          "gap-2 h-9 transition-all",
          hasDetails 
            ? "bg-blue-600 hover:bg-blue-500 text-white border-blue-500" 
            : "border-gray-700 text-gray-400 hover:text-white hover:border-blue-500/50 hover:bg-blue-500/10",
          className
        )}
      >
        {hasDetails ? (
          <>
            <Package size={14} />
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-bold">{packingDetails.total_boxes}</span>
              <span className="opacity-70">Box</span>
              <span className="opacity-40">/</span>
              <span className="font-bold">{packingDetails.total_pieces}</span>
              <span className="opacity-70">Pc</span>
              <span className="opacity-40">/</span>
              <span className="font-bold text-green-300">{packingDetails.total_meters.toFixed(1)}</span>
              <span className="opacity-70">M</span>
            </div>
            <Edit2 size={12} className="opacity-50" />
          </>
        ) : (
          <>
            <Package size={14} />
            <span className="text-xs">Add Packing</span>
          </>
        )}
      </Button>

      <PackingEntryModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onSave={onPackingChange}
        initialData={packingDetails}
        productName={productName}
      />
    </>
  );
};
