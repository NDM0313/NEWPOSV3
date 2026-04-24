import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Plus, X } from 'lucide-react';
import type { UiStageType } from '../../api/studio';

/**
 * Built-in stage presets (always available). Custom stages are added at runtime
 * and map to the 'handwork' DB stage type since the stage_type enum is fixed;
 * the user-chosen display name is persisted in localStorage keyed per order.
 */
const STAGE_OPTIONS: { id: UiStageType; name: string; icon: string }[] = [
  { id: 'dyeing', name: 'Dyeing', icon: '🎨' },
  { id: 'stitching', name: 'Stitching', icon: '🧵' },
  { id: 'handwork', name: 'Handwork', icon: '✋' },
  { id: 'embroidery', name: 'Embroidery', icon: '🌸' },
  { id: 'finishing', name: 'Finishing', icon: '✨' },
  { id: 'quality-check', name: 'Quality Check', icon: '✓' },
];

const DRAFT_KEY_PREFIX = 'studio:stageDraft:';
const CUSTOM_KEY_PREFIX = 'studio:customStageNames:';

interface CustomStageEntry {
  localId: string;
  name: string;
  mapsTo: UiStageType;
}

interface StudioStageSelectionProps {
  onBack: () => void;
  onSave: (stageTypes: UiStageType[]) => void;
  existingStageTypes?: UiStageType[];
  /** When set, the current selection is persisted in localStorage keyed by this id so back-nav preserves the draft. */
  orderId?: string;
}

export function StudioStageSelection({ onBack, onSave, existingStageTypes = [], orderId }: StudioStageSelectionProps) {
  const draftKey = orderId ? `${DRAFT_KEY_PREFIX}${orderId}` : null;
  const customKey = orderId ? `${CUSTOM_KEY_PREFIX}${orderId}` : null;

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

  // Custom stages buffer — rendered alongside presets but selections ultimately map
  // to the chosen DB stage type (defaults to 'handwork'). Name persists so the user
  // sees their label on return even though the DB type is fixed.
  const [customStages, setCustomStages] = useState<CustomStageEntry[]>(() => {
    if (!customKey) return [];
    try {
      const raw = localStorage.getItem(customKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as CustomStageEntry[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [showAdd, setShowAdd] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftMapsTo, setDraftMapsTo] = useState<UiStageType>('handwork');

  useEffect(() => {
    if (!draftKey) return;
    try {
      if (selected.length > 0) localStorage.setItem(draftKey, JSON.stringify(selected));
      else localStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
  }, [draftKey, selected]);

  useEffect(() => {
    if (!customKey) return;
    try {
      if (customStages.length > 0) localStorage.setItem(customKey, JSON.stringify(customStages));
      else localStorage.removeItem(customKey);
    } catch {
      /* ignore */
    }
  }, [customKey, customStages]);

  const toggle = (id: UiStageType) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const addCustom = () => {
    const name = draftName.trim();
    if (!name) return;
    const localId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    setCustomStages((prev) => [...prev, { localId, name, mapsTo: draftMapsTo }]);
    setSelected((prev) => [...prev, draftMapsTo]);
    setDraftName('');
    setDraftMapsTo('handwork');
    setShowAdd(false);
  };

  const removeCustom = (entry: CustomStageEntry) => {
    setCustomStages((prev) => prev.filter((c) => c.localId !== entry.localId));
    // Each custom row appended exactly one `mapsTo` slot in `selected` (see addCustom).
    // Remove one matching occurrence from the end so preset + custom both mapping to
    // the same type stay correct when only the custom row is deleted.
    setSelected((sel) => {
      const i = sel.lastIndexOf(entry.mapsTo);
      if (i === -1) return sel;
      return [...sel.slice(0, i), ...sel.slice(i + 1)];
    });
  };

  const orderLabel = useMemo(() => {
    if (selected.length === 0) return 'none';
    return selected
      .map((id) => STAGE_OPTIONS.find((o) => o.id === id)?.name ?? id)
      .join(' → ');
  }, [selected]);

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
          Tap to add to pipeline. Order: {orderLabel}
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

        {customStages.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide">Custom Stages</p>
            {customStages.map((c) => {
              const preset = STAGE_OPTIONS.find((o) => o.id === c.mapsTo);
              return (
                <div
                  key={c.localId}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border-2 bg-[#1F2937] border-[#374151] text-white"
                >
                  <span className="text-2xl">{preset?.icon ?? '⭐'}</span>
                  <div className="flex-1">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-[#9CA3AF]">Maps to {preset?.name ?? 'Handwork'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCustom(c)}
                    className="p-1.5 rounded-lg text-[#9CA3AF] hover:bg-[#374151]"
                    aria-label="Remove custom stage"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {showAdd ? (
          <div className="p-4 rounded-xl border-2 border-[#8B5CF6] bg-[#1F2937] space-y-3">
            <div>
              <label className="text-xs text-[#9CA3AF] mb-1 block">Custom stage name</label>
              <input
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="e.g. Printing, Pressing, Packaging"
                className="w-full px-3 py-2 rounded-lg bg-[#111827] border border-[#374151] text-white placeholder-[#6B7280] focus:outline-none focus:border-[#8B5CF6]"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-[#9CA3AF] mb-1 block">Worker category (for routing)</label>
              <select
                value={draftMapsTo}
                onChange={(e) => setDraftMapsTo(e.target.value as UiStageType)}
                className="w-full px-3 py-2 rounded-lg bg-[#111827] border border-[#374151] text-white focus:outline-none focus:border-[#8B5CF6]"
              >
                {STAGE_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={addCustom}
                disabled={!draftName.trim()}
                className="flex-1 py-2 rounded-lg font-semibold text-white bg-[#8B5CF6] disabled:opacity-50"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAdd(false);
                  setDraftName('');
                }}
                className="flex-1 py-2 rounded-lg font-semibold text-[#D1D5DB] bg-[#374151]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-[#4B5563] text-[#9CA3AF] hover:border-[#8B5CF6] hover:text-[#8B5CF6] transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">Add custom stage</span>
          </button>
        )}

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
