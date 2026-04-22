import { useEffect, useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import type { UiStageType } from '../../api/studio';

const STAGE_OPTIONS: { id: UiStageType; name: string; icon: string }[] = [
  { id: 'dyeing', name: 'Dyeing', icon: '🎨' },
  { id: 'stitching', name: 'Stitching', icon: '🧵' },
  { id: 'handwork', name: 'Handwork', icon: '✋' },
  { id: 'embroidery', name: 'Embroidery', icon: '🌸' },
  { id: 'finishing', name: 'Finishing', icon: '✨' },
  { id: 'quality-check', name: 'Quality Check', icon: '✓' },
];

const DRAFT_KEY_PREFIX = 'studio:stageDraft:';

interface StudioStageSelectionProps {
  onBack: () => void;
  onSave: (stageTypes: UiStageType[]) => void;
  existingStageTypes?: UiStageType[];
  /** When set, the current selection is persisted in localStorage keyed by this id so back-nav preserves the draft. */
  orderId?: string;
}

export function StudioStageSelection({ onBack, onSave, existingStageTypes = [], orderId }: StudioStageSelectionProps) {
  const draftKey = orderId ? `${DRAFT_KEY_PREFIX}${orderId}` : null;
  const [selected, setSelected] = useState<UiStageType[]>(() => {
    if (!draftKey) return [];
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as UiStageType[];
      if (Array.isArray(parsed)) {
        return parsed.filter((s) => !existingStageTypes.includes(s));
      }
      return [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (!draftKey) return;
    try {
      if (selected.length > 0) localStorage.setItem(draftKey, JSON.stringify(selected));
      else localStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
  }, [draftKey, selected]);

  const toggle = (id: UiStageType) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSave = () => {
    if (selected.length === 0) return;
    if (draftKey) {
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
    }
    onSave(selected);
  };

  return (
    <div className="min-h-screen pb-24 bg-[#111827]">
      <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-white">Assign Stages</h1>
            <p className="text-xs text-white/80">Select stages in order (1st, 2nd, 3rd…)</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <p className="text-sm text-[#9CA3AF]">
          Tap to add to pipeline. Order: {selected.length ? selected.map((id) => STAGE_OPTIONS.find((o) => o.id === id)?.name).join(' → ') : 'none'}
        </p>

        <div className="space-y-2">
          {STAGE_OPTIONS.map((opt) => {
            const isSelected = selected.includes(opt.id);
            const isExisting = existingStageTypes.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => !isExisting && toggle(opt.id)}
                disabled={isExisting}
                className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                  isExisting
                    ? 'bg-[#374151]/50 border-[#4B5563] text-[#6B7280] cursor-not-allowed'
                    : isSelected
                    ? 'bg-[#8B5CF6]/20 border-[#8B5CF6] text-white'
                    : 'bg-[#1F2937] border-[#374151] text-white hover:border-[#8B5CF6]/50'
                }`}
              >
                <span className="text-2xl">{opt.icon}</span>
                <div className="flex-1">
                  <p className="font-medium">{opt.name}</p>
                  {isExisting && <p className="text-xs text-[#9CA3AF]">Already in pipeline</p>}
                </div>
                {isSelected && !isExisting && (
                  <div className="w-8 h-8 rounded-full bg-[#8B5CF6] flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
                {isSelected && !isExisting && (
                  <span className="text-xs text-[#8B5CF6]">
                    #{selected.indexOf(opt.id) + 1}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <button
          onClick={handleSave}
          disabled={selected.length === 0}
          className="w-full py-3 rounded-xl font-semibold text-white bg-[#8B5CF6] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save {selected.length > 0 ? `${selected.length} stage(s)` : 'stages'}
        </button>
      </div>
    </div>
  );
}
