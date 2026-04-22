import { useState } from 'react';
import { X, Loader2, Minus, Plus } from 'lucide-react';
import type { InventoryItem } from '../../api/inventory';
import * as inventoryApi from '../../api/inventory';
import type { User } from '../../types';

type AdjustMode = 'add' | 'subtract' | 'set';

interface StockAdjustmentSheetProps {
  open: boolean;
  onClose: () => void;
  companyId: string;
  branchId: string | null | undefined;
  product: InventoryItem;
  user: User;
  onSaved: () => void;
}

export function StockAdjustmentSheet({
  open,
  onClose,
  companyId,
  branchId,
  product,
  user,
  onSaved,
}: StockAdjustmentSheetProps) {
  const [mode, setMode] = useState<AdjustMode>('add');
  const [qtyStr, setQtyStr] = useState('1');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const qtyNum = Math.max(0, Number(qtyStr.replace(/,/g, '')) || 0);
  const current = product.stock;

  const computeDelta = (): number | null => {
    if (qtyNum <= 0) return null;
    if (mode === 'add') return qtyNum;
    if (mode === 'subtract') return -qtyNum;
    return qtyNum - current;
  };

  const handleSave = async () => {
    const delta = computeDelta();
    if (delta == null || delta === 0) {
      setError(mode === 'set' ? 'Enter a target quantity different from current stock.' : 'Enter a quantity greater than zero.');
      return;
    }
    if (mode === 'subtract' && qtyNum > current) {
      setError(`Cannot subtract more than on-hand (${current}).`);
      return;
    }
    setSaving(true);
    setError(null);
    const noteParts = [`Stock ${mode}: ${mode === 'set' ? `${current} → ${qtyNum}` : `${delta >= 0 ? '+' : ''}${delta}`}`];
    if (notes.trim()) noteParts.push(notes.trim());
    const { error: apiErr } = await inventoryApi.createStockAdjustment({
      companyId,
      branchId: branchId ?? null,
      productId: product.id,
      quantityDelta: delta,
      notes: noteParts.join(' — '),
      createdBy: user.profileId ?? user.id,
    });
    setSaving(false);
    if (apiErr) {
      setError(apiErr);
      return;
    }
    onSaved();
    onClose();
    setQtyStr('1');
    setNotes('');
    setMode('add');
  };

  return (
    <div className="fixed inset-0 z-[110] flex flex-col justify-end">
      <button type="button" className="absolute inset-0 bg-black/60" onClick={onClose} aria-label="Close" />
      <div className="relative bg-[#111827] rounded-t-2xl border border-[#374151] shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-[#111827] border-b border-[#374151] px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-white font-semibold text-sm">Adjust stock</p>
            <p className="text-[11px] text-[#9CA3AF] truncate max-w-[260px]">{product.name}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-[#374151] text-[#9CA3AF]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex gap-2">
            <Stat label="SKU" value={product.sku} />
            <Stat label="On hand" value={String(current)} accent />
          </div>

          <div className="flex rounded-lg bg-[#1F2937] p-1 border border-[#374151]">
            {(['add', 'subtract', 'set'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 py-2 text-xs font-medium rounded-md capitalize transition ${
                  mode === m ? 'bg-[#3B82F6] text-white' : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                {m === 'set' ? 'Set qty' : m}
              </button>
            ))}
          </div>

          <div>
            <label className="text-[11px] text-[#9CA3AF] uppercase tracking-wide">
              {mode === 'set' ? 'Target quantity' : 'Quantity'}
            </label>
            <div className="mt-1 flex items-center gap-2">
              <button
                type="button"
                className="p-3 rounded-lg bg-[#1F2937] border border-[#374151] text-white"
                onClick={() => setQtyStr(String(Math.max(0, qtyNum - 1)))}
              >
                <Minus className="w-4 h-4" />
              </button>
              <input
                type="number"
                inputMode="decimal"
                className="flex-1 bg-[#1F2937] border border-[#374151] rounded-lg px-3 py-3 text-white text-center text-lg font-mono"
                value={qtyStr}
                onChange={(e) => setQtyStr(e.target.value)}
              />
              <button
                type="button"
                className="p-3 rounded-lg bg-[#1F2937] border border-[#374151] text-white"
                onClick={() => setQtyStr(String(qtyNum + 1))}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div>
            <label className="text-[11px] text-[#9CA3AF] uppercase tracking-wide">Notes (optional)</label>
            <textarea
              className="mt-1 w-full bg-[#1F2937] border border-[#374151] rounded-lg px-3 py-2 text-sm text-white placeholder-[#6B7280] min-h-[72px]"
              placeholder="Reason or reference"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {mode === 'set' && qtyNum !== current && (
            <p className="text-xs text-[#9CA3AF]">
              Net change: <span className="text-white font-mono">{qtyNum - current >= 0 ? '+' : ''}{(qtyNum - current).toFixed(2)}</span>
            </p>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="w-full h-12 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            Save adjustment
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex-1 rounded-lg bg-[#1F2937] border border-[#374151] px-3 py-2">
      <p className="text-[10px] text-[#9CA3AF] uppercase">{label}</p>
      <p className={`text-sm font-mono truncate ${accent ? 'text-[#10B981]' : 'text-white'}`}>{value}</p>
    </div>
  );
}
