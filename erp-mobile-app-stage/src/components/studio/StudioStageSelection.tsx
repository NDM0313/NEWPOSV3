import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Loader2, Plus, X } from 'lucide-react';
import type { StudioPipelineStageInput, UiStageType } from '../../api/studio';
import { useSubmitLock } from '../../contexts/LoadingContext';

/**
 * Built-in stage presets (always available). Custom stages persist as stage_type `extra`
 * with display name in notes (`[Task]: …`).
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

type PipelineEntry =
  | { kind: 'preset'; stageType: UiStageType }
  | { kind: 'extra'; localId: string; name: string };

interface StudioStageSelectionProps {
  onBack: () => void;
  onSave: (stages: StudioPipelineStageInput[]) => void | Promise<void>;
  existingStageTypes?: UiStageType[];
  /** When set, the current selection is persisted in localStorage keyed by this id so back-nav preserves the draft. */
  orderId?: string;
}

export function StudioStageSelection({ onBack, onSave, existingStageTypes = [], orderId }: StudioStageSelectionProps) {
  const { busy } = useSubmitLock();
  const draftKey = orderId ? `${DRAFT_KEY_PREFIX}${orderId}` : null;

  const [pipeline, setPipeline] = useState<PipelineEntry[]>(() => {
    if (!draftKey) return [];
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as PipelineEntry[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [showAdd, setShowAdd] = useState(false);
  const [draftName, setDraftName] = useState('');

  useEffect(() => {
    if (!draftKey) return;
    try {
      if (pipeline.length > 0) localStorage.setItem(draftKey, JSON.stringify(pipeline));
      else localStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
  }, [draftKey, pipeline]);

  const togglePreset = (id: UiStageType) => {
    setPipeline((prev) => {
      const idx = prev.findIndex((e) => e.kind === 'preset' && e.stageType === id);
      if (idx >= 0) return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
      return [...prev, { kind: 'preset', stageType: id }];
    });
  };

  const addCustom = () => {
    const name = draftName.trim();
    if (!name) return;
    const localId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    setPipeline((prev) => [...prev, { kind: 'extra', localId, name }]);
    setDraftName('');
    setShowAdd(false);
  };

  const removeCustom = (localId: string) => {
    setPipeline((prev) => prev.filter((e) => !(e.kind === 'extra' && e.localId === localId)));
  };

  const customEntries = pipeline.filter((e): e is Extract<PipelineEntry, { kind: 'extra' }> => e.kind === 'extra');

  const orderLabel = useMemo(() => {
    if (pipeline.length === 0) return 'none';
    return pipeline
      .map((e) =>
        e.kind === 'extra'
          ? e.name
          : STAGE_OPTIONS.find((o) => o.id === e.stageType)?.name ?? e.stageType
      )
      .join(' → ');
  }, [pipeline]);

  const handleSave = async () => {
    if (busy || pipeline.length === 0) return;
    if (draftKey) {
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
    }
    const entries: StudioPipelineStageInput[] = pipeline.map((e) =>
      e.kind === 'extra' ? { kind: 'extra', label: e.name } : { kind: 'preset', stageType: e.stageType }
    );
    await onSave(entries);
  };

  return (
    <div className="min-h-screen pb-24 bg-[#111827]">
      <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] p-4 sticky top-0 z-10 flow-screen-header">
        <div className="flex items-center gap-3 mb-2">
          <button
            type="button"
            onClick={onBack}
            disabled={busy}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white disabled:opacity-50 disabled:pointer-events-none"
          >
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
            const idx = pipeline.findIndex((e) => e.kind === 'preset' && e.stageType === opt.id);
            const isSelected = idx >= 0;
            const isExisting = existingStageTypes.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => !isExisting && togglePreset(opt.id)}
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
                  <span className="text-xs text-[#8B5CF6]">#{idx + 1}</span>
                )}
              </button>
            );
          })}
        </div>

        {customEntries.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide">Custom tasks</p>
            {customEntries.map((c) => {
              const idx = pipeline.findIndex((e) => e.kind === 'extra' && e.localId === c.localId);
              return (
                <div
                  key={c.localId}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border-2 bg-[#8B5CF6]/20 border-[#8B5CF6] text-white"
                >
                  <span className="text-2xl">⭐</span>
                  <div className="flex-1">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-[#C4B5FD]">Custom task · #{idx + 1}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCustom(c.localId)}
                    className="p-1.5 rounded-lg text-[#9CA3AF] hover:bg-[#374151]"
                    aria-label="Remove custom task"
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
              <label className="text-xs text-[#9CA3AF] mb-1 block">Custom task name</label>
              <input
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="e.g. Printing, Pressing, Packaging"
                className="w-full px-3 py-2 rounded-lg bg-[#111827] border border-[#374151] text-white placeholder-[#6B7280] focus:outline-none focus:border-[#8B5CF6]"
                autoFocus
              />
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
            <span className="text-sm font-medium">Add custom task</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={busy || pipeline.length === 0}
          className="w-full py-3 rounded-xl font-semibold text-white bg-[#8B5CF6] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          {busy ? 'Saving…' : `Save ${pipeline.length > 0 ? `${pipeline.length} stage(s)` : 'stages'}`}
        </button>
      </div>
    </div>
  );
}
