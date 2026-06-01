import { useState, useEffect, useMemo } from 'react';
import { X, Loader2, Minus, Plus, MapPin, ArrowRightLeft } from 'lucide-react';
import type { InventoryItem } from '../../api/inventory';
import * as inventoryApi from '../../api/inventory';
import type { User } from '../../types';
import { useWriteBranchSelection } from '../../hooks/useWriteBranchSelection';
import { WriteBranchPickerField } from '../shared/WriteBranchPickerField';
import { fetchProductStockByKey } from '../../utils/productStockFetch';
import { useSubmitLock } from '../../contexts/LoadingContext';
import { SaveBlockingOverlay } from '../common/SaveBlockingOverlay';

type AdjustMode = 'add' | 'subtract' | 'set';
type SheetMode = 'adjust' | 'transfer';

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
  const [sheetMode, setSheetMode] = useState<SheetMode>('adjust');
  const [mode, setMode] = useState<AdjustMode>('add');
  const [qtyStr, setQtyStr] = useState('1');
  const [notes, setNotes] = useState('');
  const [toBranchId, setToBranchId] = useState<string | null>(null);
  const { run: runSave, busy: saving } = useSubmitLock();
  const [error, setError] = useState<string | null>(null);
  const [displayStock, setDisplayStock] = useState(product.stock);
  const [loadingStock, setLoadingStock] = useState(false);

  const {
    effectiveBranchId,
    needsPicker,
    pickerBranches,
    pickedBranchId,
    setPickedBranchId,
    loading: loadingBranches,
    ready: branchReady,
    error: branchError,
    accessibleBranches,
  } = useWriteBranchSelection({
    companyId,
    globalBranchId: branchId,
    userRole: user.role,
    authUserId: user.id,
    profileId: user.profileId,
  });

  const branchOptions = needsPicker ? pickerBranches : accessibleBranches;
  const canTransfer = branchOptions.length > 1;
  const destinationBranches = useMemo(
    () => branchOptions.filter((b) => b.id !== effectiveBranchId),
    [branchOptions, effectiveBranchId],
  );

  useEffect(() => {
    if (!open) return;
    setSheetMode('adjust');
    setMode('add');
    setQtyStr('1');
    setNotes('');
    setToBranchId(null);
    setError(null);
    setDisplayStock(product.stock);
  }, [open, product.id, product.stock]);

  useEffect(() => {
    if (!toBranchId && destinationBranches.length > 0) {
      setToBranchId(destinationBranches[0].id);
    } else if (toBranchId && !destinationBranches.some((b) => b.id === toBranchId)) {
      setToBranchId(destinationBranches[0]?.id ?? null);
    }
  }, [destinationBranches, toBranchId]);

  useEffect(() => {
    if (!open || !companyId || !effectiveBranchId) {
      if (!open) return;
      setDisplayStock(product.stock);
      return;
    }
    let cancelled = false;
    setLoadingStock(true);
    void fetchProductStockByKey(companyId, [product.id], [product.id], [], effectiveBranchId)
      .then((map) => {
        if (cancelled) return;
        setDisplayStock(map[product.id] ?? 0);
      })
      .catch(() => {
        if (!cancelled) setDisplayStock(product.stock);
      })
      .finally(() => {
        if (!cancelled) setLoadingStock(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, companyId, effectiveBranchId, product.id, product.stock]);

  if (!open) return null;

  const qtyNum = Math.max(0, Number(qtyStr.replace(/,/g, '')) || 0);
  const current = displayStock;
  const transferQtyOver =
    sheetMode === 'transfer' && !loadingStock && qtyNum > 0 && qtyNum > current;
  const transferQtyHint =
    transferQtyOver && current >= 0
      ? `You're entering more than available stock (on hand: ${current}).`
      : null;
  const fromBranchLabel =
    accessibleBranches.find((b) => b.id === effectiveBranchId)?.name ??
    pickerBranches.find((b) => b.id === effectiveBranchId)?.name;
  const toBranchLabel = destinationBranches.find((b) => b.id === toBranchId)?.name;

  const computeDelta = (): number | null => {
    if (qtyNum <= 0) return null;
    if (mode === 'add') return qtyNum;
    if (mode === 'subtract') return -qtyNum;
    return qtyNum - current;
  };

  const handleSave = async () => {
    if (!branchReady || !effectiveBranchId) {
      setError(branchError ?? (sheetMode === 'transfer' ? 'Select a source branch.' : 'Select a branch for this adjustment.'));
      return;
    }

    if (sheetMode === 'transfer') {
      if (!canTransfer) {
        setError('Branch transfer requires at least two branches.');
        return;
      }
      if (!toBranchId) {
        setError('Select a destination branch.');
        return;
      }
      if (qtyNum <= 0) {
        setError('Enter a quantity greater than zero.');
        return;
      }
      if (qtyNum > current) {
        setError(
          current >= 0
            ? `You're entering more than available stock (on hand: ${current}).`
            : 'Enter a quantity within available stock.',
        );
        return;
      }
      await runSave('Transferring stock...', async () => {
        setError(null);
        const { error: apiErr } = await inventoryApi.createStockTransfer({
          companyId,
          productId: product.id,
          fromBranchId: effectiveBranchId,
          toBranchId,
          quantity: qtyNum,
          notes: notes.trim() || null,
          createdBy: user.profileId ?? user.id,
          fromBranchName: fromBranchLabel ?? null,
          toBranchName: toBranchLabel ?? null,
        });
        if (apiErr) {
          setError(apiErr);
          return;
        }
        onSaved();
        onClose();
        setQtyStr('1');
        setNotes('');
        setSheetMode('adjust');
        setMode('add');
      });
      return;
    }

    const delta = computeDelta();
    if (delta == null || delta === 0) {
      setError(mode === 'set' ? 'Enter a target quantity different from current stock.' : 'Enter a quantity greater than zero.');
      return;
    }
    if (mode === 'subtract' && qtyNum > current) {
      setError(`Cannot subtract more than on-hand (${current}).`);
      return;
    }
    await runSave('Saving adjustment...', async () => {
      setError(null);
      const noteParts = [
        mode === 'set'
          ? `Stock set: ${current} → ${qtyNum}`
          : `Stock ${mode}: ${delta >= 0 ? '+' : ''}${delta}`,
      ];
      if (notes.trim()) noteParts.push(notes.trim());
      const { error: apiErr } = await inventoryApi.createStockAdjustment({
        companyId,
        branchId: effectiveBranchId,
        productId: product.id,
        quantityDelta: delta,
        notes: noteParts.join(' — '),
        createdBy: user.profileId ?? user.id,
      });
      if (apiErr) {
        setError(apiErr);
        return;
      }
      onSaved();
      onClose();
      setQtyStr('1');
      setNotes('');
      setMode('add');
    });
  };

  const displayError = error ?? branchError;
  const saveDisabled =
    saving ||
    loadingBranches ||
    !branchReady ||
    loadingStock ||
    (sheetMode === 'transfer' &&
      (!toBranchId || !canTransfer || qtyNum <= 0 || transferQtyOver));

  const saveLabel = sheetMode === 'transfer' ? 'Transfer stock' : 'Save adjustment';
  const overlayLabel = sheetMode === 'transfer' ? 'Transferring stock...' : 'Saving adjustment...';

  return (
    <div className="fixed inset-0 z-[110] flex flex-col justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        onClick={saving ? undefined : onClose}
        aria-label="Close"
        disabled={saving}
      />
      <div className="relative bg-[#111827] rounded-t-2xl border border-[#374151] shadow-2xl max-h-[85vh] overflow-y-auto">
        <SaveBlockingOverlay active={saving} label={overlayLabel} />
        <div className="sticky top-0 bg-[#111827] border-b border-[#374151] px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-white font-semibold text-sm">
              {sheetMode === 'transfer' ? 'Transfer stock' : 'Adjust stock'}
            </p>
            <p className="text-[11px] text-[#9CA3AF] truncate max-w-[260px]">{product.name}</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="p-2 rounded-lg hover:bg-[#374151] text-[#9CA3AF] disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {canTransfer && (
            <div className="flex rounded-lg bg-[#1F2937] p-1 border border-[#374151]">
              <button
                type="button"
                onClick={() => setSheetMode('adjust')}
                className={`flex-1 py-2 text-xs font-medium rounded-md transition ${
                  sheetMode === 'adjust' ? 'bg-[#3B82F6] text-white' : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                Adjust
              </button>
              <button
                type="button"
                onClick={() => setSheetMode('transfer')}
                className={`flex-1 py-2 text-xs font-medium rounded-md transition flex items-center justify-center gap-1 ${
                  sheetMode === 'transfer' ? 'bg-[#8B5CF6] text-white' : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                Transfer
              </button>
            </div>
          )}

          {loadingBranches ? (
            <div className="flex items-center gap-2 text-sm text-[#9CA3AF] py-1">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading branches…
            </div>
          ) : needsPicker && pickerBranches.length > 1 ? (
            <WriteBranchPickerField
              branches={pickerBranches}
              value={pickedBranchId}
              onChange={setPickedBranchId}
              helperText={
                sheetMode === 'transfer'
                  ? 'From branch — stock will leave here.'
                  : 'Stock adjustment is recorded under the selected branch.'
              }
              zIndexClass="z-[120]"
            />
          ) : effectiveBranchId && fromBranchLabel ? (
            <div className="flex items-center gap-2 text-sm text-[#9CA3AF] py-1">
              <MapPin className="w-4 h-4 text-[#10B981] shrink-0" />
              <span>
                {sheetMode === 'transfer' ? 'From: ' : 'Branch: '}
                <span className="text-white font-medium">{fromBranchLabel}</span>
              </span>
            </div>
          ) : null}

          {sheetMode === 'transfer' && canTransfer && destinationBranches.length > 0 && (
            <WriteBranchPickerField
              branches={destinationBranches}
              value={toBranchId ?? ''}
              onChange={setToBranchId}
              helperText="To branch — stock will be added here."
              zIndexClass="z-[120]"
            />
          )}

          <div className="flex gap-2">
            <Stat label="SKU" value={product.sku} />
            <Stat label="On hand" value={loadingStock ? '…' : String(current)} accent />
          </div>

          {sheetMode === 'adjust' && (
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
          )}

          <div>
            <label className="text-[11px] text-[#9CA3AF] uppercase tracking-wide">
              {sheetMode === 'transfer' ? 'Transfer quantity' : mode === 'set' ? 'Target quantity' : 'Quantity'}
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
                inputMode="numeric"
                className="flex-1 bg-[#1F2937] border border-[#374151] rounded-lg px-3 py-3 text-white text-center text-lg font-mono"
                value={qtyStr}
                onChange={(e) => {
                  setQtyStr(e.target.value);
                  if (error && sheetMode === 'transfer') setError(null);
                }}
              />
              <button
                type="button"
                className="p-3 rounded-lg bg-[#1F2937] border border-[#374151] text-white disabled:opacity-40"
                disabled={sheetMode === 'transfer' && qtyNum >= current && current > 0}
                onClick={() => {
                  const next = qtyNum + 1;
                  if (sheetMode === 'transfer' && current > 0 && next > current) return;
                  setQtyStr(String(next));
                  if (error && transferQtyOver) setError(null);
                }}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {transferQtyHint && (
              <p className="mt-1.5 text-sm text-amber-400" role="alert">
                {transferQtyHint}
              </p>
            )}
          </div>

          {sheetMode === 'transfer' && qtyNum > 0 && toBranchId && fromBranchLabel && toBranchLabel && (
            <p className="text-xs text-[#9CA3AF]">
              Move <span className="text-white font-medium">{qtyNum}</span> from {fromBranchLabel} → {toBranchLabel}
            </p>
          )}

          <div>
            <label className="text-[11px] text-[#9CA3AF] uppercase tracking-wide">Notes (optional)</label>
            <textarea
              className="mt-1 w-full bg-[#1F2937] border border-[#374151] rounded-lg px-3 py-2 text-sm text-white placeholder-[#6B7280] min-h-[72px]"
              placeholder="Reason or reference"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {sheetMode === 'adjust' && mode === 'set' && qtyNum !== current && (
            <p className="text-xs text-[#9CA3AF]">
              Net change:{' '}
              <span className="text-white font-mono">
                {qtyNum - current >= 0 ? '+' : ''}
                {(qtyNum - current).toFixed(2)}
              </span>
            </p>
          )}

          {displayError && <p className="text-sm text-red-400">{displayError}</p>}

          <button
            type="button"
            disabled={saveDisabled}
            onClick={handleSave}
            className={`w-full h-12 rounded-xl text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50 ${
              sheetMode === 'transfer' ? 'bg-[#8B5CF6] hover:bg-[#7C3AED]' : 'bg-[#10B981] hover:bg-[#059669]'
            }`}
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            {saveLabel}
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
