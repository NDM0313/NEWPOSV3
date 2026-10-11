import { MapPin } from 'lucide-react';

export interface DocumentBranchGateModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  branches: Array<{ id: string; name: string }>;
  accentClass?: string;
  onPick: (branchId: string) => void;
  onCancel: () => void;
}

export function DocumentBranchGateModal({
  open,
  title,
  subtitle = 'Choose which branch this document is for',
  branches,
  accentClass = 'text-[#3B82F6] hover:border-[#3B82F6]',
  onPick,
  onCancel,
}: DocumentBranchGateModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center"
      onClick={onCancel}
    >
      <div
        className="bg-[#1F2937] border-t sm:border border-[#374151] rounded-t-2xl sm:rounded-xl w-full max-w-md max-h-[70vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-[#374151]">
          <h3 className="font-semibold text-white">{title}</h3>
          <p className="text-sm text-[#9CA3AF]">{subtitle}</p>
        </div>
        <div className="p-4 overflow-y-auto max-h-[50vh] space-y-2">
          {branches.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => onPick(b.id)}
              className={`w-full flex flex-col items-center justify-center text-center gap-2 p-5 bg-[#111827] border border-[#374151] rounded-xl transition-colors ${accentClass}`}
            >
              <MapPin className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium text-white">{b.name}</span>
            </button>
          ))}
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
