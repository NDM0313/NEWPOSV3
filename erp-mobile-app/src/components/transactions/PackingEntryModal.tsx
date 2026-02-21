import { useState, useEffect } from 'react';
import { Package, Layers, Ruler, X, Plus, Trash2, Zap } from 'lucide-react';
import { NumpadInput } from '../common/NumpadInput';

export interface PackingDetails {
  total_boxes?: number;
  total_pieces?: number;
  total_meters?: number;
  boxes?: { box_no: number; pieces: number[] }[];
  loose_pieces?: number[];
  entry_mode?: 'detailed' | 'quick';
}

interface PackingEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (details: PackingDetails) => void;
  initialData?: PackingDetails;
  productName?: string;
}

export function PackingEntryModal({
  open,
  onOpenChange,
  onSave,
  initialData,
  productName = 'Product',
}: PackingEntryModalProps) {
  const [mode, setMode] = useState<'detailed' | 'quick'>('detailed');
  const [boxes, setBoxes] = useState<{ box_no: number; pieces: number[] }[]>([]);
  const [loosePieces, setLoosePieces] = useState<number[]>([]);
  const [quickBoxes, setQuickBoxes] = useState(0);
  const [quickPieces, setQuickPieces] = useState(0);
  const [quickMeters, setQuickMeters] = useState(0);
  const [autoOpenPiece, setAutoOpenPiece] = useState<{ boxNo: number; pieceIdx: number } | null>(null);
  const [autoOpenLoose, setAutoOpenLoose] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initialData) {
      const hasDetailedStructure =
        (initialData.boxes?.length ?? 0) > 0 || (initialData.loose_pieces?.length ?? 0) > 0;
      const useQuick =
        initialData.entry_mode === 'quick' ||
        (!hasDetailedStructure &&
          ((initialData.total_boxes ?? 0) > 0 ||
            (initialData.total_pieces ?? 0) > 0 ||
            (initialData.total_meters ?? 0) > 0));

      if (useQuick) {
        setMode('quick');
        setQuickBoxes(initialData.total_boxes ?? 0);
        setQuickPieces(initialData.total_pieces ?? 0);
        setQuickMeters(initialData.total_meters ?? 0);
        setBoxes([]);
        setLoosePieces([]);
      } else {
        setMode('detailed');
        setBoxes(initialData.boxes ?? []);
        setLoosePieces(initialData.loose_pieces ?? []);
        setQuickBoxes(0);
        setQuickPieces(0);
        setQuickMeters(0);
      }
    } else {
      setMode('detailed');
      setBoxes([]);
      setLoosePieces([]);
      setQuickBoxes(0);
      setQuickPieces(0);
      setQuickMeters(0);
    }
  }, [open, initialData]);

  const addBox = () => {
    const newNo = boxes.length > 0 ? Math.max(...boxes.map((b) => b.box_no)) + 1 : 1;
    setBoxes([...boxes, { box_no: newNo, pieces: [0] }]);
  };

  const removeBox = (boxNo: number) => {
    setBoxes(boxes.filter((b) => b.box_no !== boxNo));
  };

  const addPieceToBox = (boxNo: number) => {
    setBoxes(
      boxes.map((b) =>
        b.box_no === boxNo ? { ...b, pieces: [...b.pieces, 0] } : b
      )
    );
  };

  const removePieceFromBox = (boxNo: number, idx: number) => {
    setBoxes(
      boxes.map((b) => {
        if (b.box_no !== boxNo) return b;
        const newPieces = b.pieces.filter((_, i) => i !== idx);
        return { ...b, pieces: newPieces.length ? newPieces : [0] };
      })
    );
  };

  const updatePiece = (boxNo: number, idx: number, val: number) => {
    setBoxes(
      boxes.map((b) =>
        b.box_no === boxNo
          ? { ...b, pieces: b.pieces.map((p, i) => (i === idx ? val : p)) }
          : b
      )
    );
  };

  const addLoosePiece = () => {
    const newIdx = loosePieces.length;
    setLoosePieces([...loosePieces, 0]);
    setAutoOpenLoose(newIdx);
  };

  useEffect(() => {
    if (autoOpenPiece || autoOpenLoose !== null) {
      const t = setTimeout(() => {
        setAutoOpenPiece(null);
        setAutoOpenLoose(null);
      }, 50);
      return () => clearTimeout(t);
    }
  }, [autoOpenPiece, autoOpenLoose]);
  const removeLoosePiece = (idx: number) =>
    setLoosePieces(loosePieces.filter((_, i) => i !== idx));
  const updateLoosePiece = (idx: number, val: number) => {
    const next = [...loosePieces];
    next[idx] = val;
    setLoosePieces(next);
  };

  const calcDetailedTotals = () => {
    const validBoxes = boxes.filter((b) => b.pieces.some((p) => p > 0));
    const boxPieces = validBoxes.reduce(
      (s, b) => s + b.pieces.filter((p) => p > 0).length,
      0
    );
    const validLoose = loosePieces.filter((p) => p > 0);
    const totalPieces = boxPieces + validLoose.length;
    const totalMeters =
      validBoxes.reduce(
        (s, b) => s + b.pieces.filter((p) => p > 0).reduce((a, p) => a + p, 0),
        0
      ) + validLoose.reduce((a, p) => a + p, 0);
    return {
      total_boxes: validBoxes.length,
      total_pieces: totalPieces,
      total_meters: parseFloat(totalMeters.toFixed(2)),
    };
  };

  const calcQuickTotals = () => ({
    total_boxes: quickBoxes,
    total_pieces: quickPieces,
    total_meters: parseFloat((quickMeters || 0).toFixed(2)),
  });

  const totals =
    mode === 'detailed' ? calcDetailedTotals() : calcQuickTotals();

  const handleSave = () => {
    if (mode === 'quick') {
      onSave({
        total_boxes: quickBoxes,
        total_pieces: quickPieces,
        total_meters: quickMeters,
        entry_mode: 'quick',
      });
    } else {
      onSave({
        boxes,
        loose_pieces: loosePieces,
        ...calcDetailedTotals(),
        entry_mode: 'detailed',
      });
    }
    onOpenChange(false);
  };

  const canSave =
    mode === 'detailed'
      ? totals.total_meters > 0
      : totals.total_meters > 0 || totals.total_pieces > 0;

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 z-[80]"
        onClick={() => onOpenChange(false)}
        aria-hidden
      />
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 bg-[#1F2937] border border-[#374151] rounded-2xl z-[80] max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#374151] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-[#3B82F6]" />
            <div>
              <h2 className="text-lg font-semibold text-[#F9FAFB]">Packing Entry</h2>
              <p className="text-xs text-[#9CA3AF]">{productName}</p>
            </div>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-2 hover:bg-[#374151] rounded-lg text-[#F9FAFB]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Toggle */}
        <div className="px-4 py-3 border-b border-[#374151] flex gap-2">
          <button
            onClick={() => setMode('detailed')}
            className={`flex-1 h-10 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${
              mode === 'detailed'
                ? 'bg-[#3B82F6] text-white'
                : 'bg-[#111827] text-[#9CA3AF] border border-[#374151]'
            }`}
          >
            <Package size={14} />
            Detailed
          </button>
          <button
            onClick={() => setMode('quick')}
            className={`flex-1 h-10 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${
              mode === 'quick'
                ? 'bg-[#3B82F6] text-white'
                : 'bg-[#111827] text-[#9CA3AF] border border-[#374151]'
            }`}
          >
            <Zap size={14} />
            Quick
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {mode === 'detailed' ? (
            <div className="space-y-4">
              {/* Boxes */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-[#F9FAFB]">Boxes</h4>
                  <button
                    onClick={addBox}
                    className="px-3 py-1.5 bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm rounded-lg font-medium flex items-center gap-1.5"
                  >
                    <Plus size={14} />
                    Add Box
                  </button>
                </div>
                {boxes.length === 0 ? (
                  <div className="text-center py-8 text-sm text-[#6B7280] bg-[#111827] rounded-lg border border-[#374151]">
                    No boxes added yet
                  </div>
                ) : (
                  <div className="space-y-2">
                    {boxes.map((box) => (
                      <div
                        key={box.box_no}
                        className="bg-[#111827] border border-[#374151] rounded-xl p-4"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-[#F9FAFB]">
                            Box #{box.box_no}
                          </span>
                          <button
                            onClick={() => removeBox(box.box_no)}
                            className="p-2 hover:bg-[#374151] rounded-lg"
                          >
                            <Trash2 size={14} className="text-[#EF4444]" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          {box.pieces.map((val, idx) => (
                            <div key={idx} className="relative">
                              <NumpadInput
                                value={val || 0}
                                onChange={(v) => updatePiece(box.box_no, idx, v)}
                                onEnter={() => {
                                  const newIdx = box.pieces.length;
                                  addPieceToBox(box.box_no);
                                  setAutoOpenPiece({ boxNo: box.box_no, pieceIdx: newIdx });
                                }}
                                autoOpen={autoOpenPiece?.boxNo === box.box_no && autoOpenPiece?.pieceIdx === idx}
                                allowDecimal
                                min={0}
                                className="pr-8"
                              />
                              {box.pieces.length > 1 && (
                                <button
                                  onClick={() => removePieceFromBox(box.box_no, idx)}
                                  className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center z-10"
                                >
                                  <X size={12} className="text-[#EF4444]" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() => addPieceToBox(box.box_no)}
                          className="w-full h-9 border-2 border-dashed border-[#374151] rounded-lg text-xs text-[#9CA3AF] hover:border-[#3B82F6] hover:text-[#3B82F6] flex items-center justify-center gap-1"
                        >
                          <Plus size={12} />
                          Add Piece
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Loose Pieces */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-[#F9FAFB]">Loose Pieces</h4>
                  <button
                    onClick={addLoosePiece}
                    className="px-3 py-1.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-sm rounded-lg font-medium flex items-center gap-1.5"
                  >
                    <Plus size={14} />
                    Add
                  </button>
                </div>
                {loosePieces.length === 0 ? (
                  <p className="text-xs text-[#6B7280] italic text-center py-3 bg-[#111827] rounded-lg border border-[#374151]">
                    Optional: Add pieces without box
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {loosePieces.map((val, idx) => (
                      <div key={idx} className="relative">
                        <NumpadInput
                          value={val || 0}
                          onChange={(v) => updateLoosePiece(idx, v)}
                          onEnter={addLoosePiece}
                          autoOpen={autoOpenLoose === idx}
                          allowDecimal
                          min={0}
                          className="pr-8 border-[#8B5CF6]/50 focus:border-[#8B5CF6]"
                        />
                        <button
                          onClick={() => removeLoosePiece(idx)}
                          className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center z-10"
                        >
                          <X size={12} className="text-[#EF4444]" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Quick mode */
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#9CA3AF] mb-2">
                  Number of Boxes
                </label>
                <div className="relative">
                  <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280] z-10 pointer-events-none" />
                  <NumpadInput
                    value={quickBoxes || 0}
                    onChange={(v) => setQuickBoxes(Math.round(v))}
                    allowDecimal={false}
                    min={0}
                    className="h-12 pl-11"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#9CA3AF] mb-2">
                  Number of Pieces
                </label>
                <div className="relative">
                  <Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280] z-10 pointer-events-none" />
                  <NumpadInput
                    value={quickPieces || 0}
                    onChange={(v) => setQuickPieces(Math.round(v))}
                    allowDecimal={false}
                    min={0}
                    className="h-12 pl-11"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#9CA3AF] mb-2">
                  Total Meters
                </label>
                <div className="relative">
                  <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#10B981] z-10 pointer-events-none" />
                  <NumpadInput
                    value={quickMeters || 0}
                    onChange={setQuickMeters}
                    allowDecimal
                    min={0}
                    placeholder="0.00"
                    className="h-12 pl-11 pr-10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#6B7280] pointer-events-none">
                    M
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Summary & Actions */}
        <div className="p-4 border-t border-[#374151] flex-shrink-0">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-[#111827] rounded-lg p-3 text-center">
              <div className="text-xs text-[#9CA3AF] mb-1">Boxes</div>
              <div className="text-xl font-bold text-[#3B82F6]">
                {totals.total_boxes ?? 0}
              </div>
            </div>
            <div className="bg-[#111827] rounded-lg p-3 text-center">
              <div className="text-xs text-[#9CA3AF] mb-1">Pieces</div>
              <div className="text-xl font-bold text-[#8B5CF6]">
                {totals.total_pieces ?? 0}
              </div>
            </div>
            <div className="bg-[#111827] rounded-lg p-3 text-center">
              <div className="text-xs text-[#9CA3AF] mb-1">M</div>
              <div className="text-xl font-bold text-[#10B981]">
                {(totals.total_meters ?? 0).toFixed(2)}
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => onOpenChange(false)}
              className="flex-1 h-12 border border-[#374151] rounded-lg font-medium hover:bg-[#374151] text-[#F9FAFB]"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="flex-1 h-12 bg-[#3B82F6] hover:bg-[#2563EB] disabled:bg-[#374151] disabled:text-[#6B7280] rounded-lg font-medium text-[#F9FAFB]"
            >
              Save Packing
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
