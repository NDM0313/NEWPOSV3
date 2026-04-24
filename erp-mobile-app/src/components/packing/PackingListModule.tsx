import { useState, useEffect } from 'react';
import { ArrowLeft, Package, Loader2, ListChecks, Eye, Truck, SquarePen } from 'lucide-react';
import type { User } from '../../types';
import * as salesApi from '../../api/sales';
import * as packingListApi from '../../api/packingList';
import { ShipmentModal } from '../shipment/ShipmentModal';

interface PackingListModuleProps {
  onBack: () => void;
  user: User;
  companyId: string | null;
  branchId: string | null;
}

type View = 'sales' | 'items';

export function PackingListModule({ onBack, user, companyId, branchId }: PackingListModuleProps) {
  const [sales, setSales] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('sales');
  const [currentPackingListId, setCurrentPackingListId] = useState<string | null>(null);
  const [packingItems, setPackingItems] = useState<packingListApi.PackingListItemRow[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsEditMode, setItemsEditMode] = useState(false);
  const [itemDraft, setItemDraft] = useState<Array<{ id: string; pieces: number; cartons: number; weight: string }>>([]);
  const [packingSaveLoading, setPackingSaveLoading] = useState(false);
  const [creatingSaleId, setCreatingSaleId] = useState<string | null>(null);
  const [salePackingMap, setSalePackingMap] = useState<Record<string, string>>({}); // saleId -> first packing list id
  const [shipmentSaleId, setShipmentSaleId] = useState<string | null>(null);
  const [shipmentSaleLabel, setShipmentSaleLabel] = useState<string | null>(null);
  const [shipmentBranchId, setShipmentBranchId] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      salesApi.getAllSales(companyId, branchId ?? undefined),
      packingListApi.listPackingListsByCompany(companyId),
    ]).then(([salesRes, plRes]) => {
      setLoading(false);
      if (salesRes.error) setError(salesRes.error);
      else setSales(salesRes.data || []);
      if (plRes.data?.length) {
        const map: Record<string, string> = {};
        for (const pl of plRes.data) {
          if (pl.sale_id && !map[pl.sale_id]) map[pl.sale_id] = pl.id;
        }
        setSalePackingMap(map);
      }
    });
  }, [companyId, branchId]);

  const handleCreatePackingList = async (saleId: string) => {
    if (!companyId || !user?.id) return;
    setCreatingSaleId(saleId);
    setError(null);
    const { data, error: err } = await packingListApi.createPackingListFromSale({
      companyId,
      saleId,
      branchId: branchId ?? undefined,
      createdBy: user.id,
    });
    setCreatingSaleId(null);
    if (err) {
      setError(err);
      return;
    }
    if (data) {
      setSalePackingMap((prev) => ({ ...prev, [saleId]: data.id }));
      setCurrentPackingListId(data.id);
      setPackingItems(data.items || []);
      setItemsEditMode(false);
      setView('items');
    }
  };

  const handleViewPackingItems = async (saleId: string) => {
    const plId = salePackingMap[saleId];
    if (plId) {
      setCurrentPackingListId(plId);
      setView('items');
      setItemsLoading(true);
      const { data } = await packingListApi.getPackingListWithItems(plId);
      setItemsLoading(false);
      if (data?.items) setPackingItems(data.items);
      setItemsEditMode(false);
      return;
    }
    const { data } = await packingListApi.listPackingListsBySale(saleId);
    if (data?.length) {
      const first = data[0];
      setSalePackingMap((prev) => ({ ...prev, [saleId]: first.id }));
      setCurrentPackingListId(first.id);
      setView('items');
      setItemsLoading(true);
      const res = await packingListApi.getPackingListWithItems(first.id);
      setItemsLoading(false);
      if (res.data?.items) setPackingItems(res.data.items);
      setItemsEditMode(false);
    } else {
      setError('No packing list found for this sale.');
    }
  };

  const getPackingListIdForSale = (saleId: string): string | null => salePackingMap[saleId] ?? null;

  const startPackingItemEdit = () => {
    setItemDraft(
      packingItems.map((i) => ({
        id: i.id,
        pieces: Math.max(0, Math.floor(Number(i.pieces) || 0)),
        cartons: Math.max(0, Math.floor(Number(i.cartons) || 0)),
        weight: i.weight ?? '',
      })),
    );
    setItemsEditMode(true);
    setError(null);
  };

  const cancelPackingItemEdit = async () => {
    setItemsEditMode(false);
    if (currentPackingListId) {
      setItemsLoading(true);
      const { data } = await packingListApi.getPackingListWithItems(currentPackingListId);
      setItemsLoading(false);
      if (data?.items) setPackingItems(data.items);
    }
  };

  const updatePackingDraftRow = (id: string, patch: Partial<{ pieces: number; cartons: number; weight: string }>) => {
    setItemDraft((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const savePackingItemEdits = async () => {
    if (!currentPackingListId) return;
    setPackingSaveLoading(true);
    setError(null);
    try {
      for (const row of itemDraft) {
        const orig = packingItems.find((i) => i.id === row.id);
        if (!orig) continue;
        const wOrig = (orig.weight ?? '').trim();
        const wNew = row.weight.trim();
        if (orig.pieces === row.pieces && orig.cartons === row.cartons && wOrig === wNew) continue;
        const { error: upErr } = await packingListApi.updatePackingListItem(row.id, {
          pieces: row.pieces,
          cartons: row.cartons,
          weight: wNew.length ? wNew : null,
        });
        if (upErr) {
          setError(upErr);
          return;
        }
      }
      const { data } = await packingListApi.getPackingListWithItems(currentPackingListId);
      if (data?.items) setPackingItems(data.items);
      setItemsEditMode(false);
    } finally {
      setPackingSaveLoading(false);
    }
  };

  if (view === 'items') {
    return (
      <div className="min-h-screen bg-[#111827] pb-24">
        <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
          <div className="flex items-center gap-3 px-4 h-14">
            <button
              type="button"
              onClick={() => {
                setView('sales');
                setItemsEditMode(false);
                setCurrentPackingListId(null);
              }}
              className="p-2 hover:bg-[#374151] rounded-lg text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Package className="w-6 h-6 text-[#10B981]" />
            <h1 className="text-white font-semibold text-base min-w-0 truncate">Packing Items</h1>
            {!itemsLoading && packingItems.length > 0 && !itemsEditMode && (
              <button
                type="button"
                onClick={startPackingItemEdit}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#3B82F6]/20 text-[#93C5FD] text-sm font-medium shrink-0"
              >
                <SquarePen className="w-4 h-4" />
                Edit
              </button>
            )}
            {itemsEditMode && (
              <div className="ml-auto flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void cancelPackingItemEdit()}
                  disabled={packingSaveLoading}
                  className="px-3 py-1.5 rounded-lg border border-[#374151] text-[#D1D5DB] text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void savePackingItemEdits()}
                  disabled={packingSaveLoading}
                  className="px-3 py-1.5 rounded-lg bg-[#10B981] text-white text-sm font-medium disabled:opacity-50"
                >
                  {packingSaveLoading ? 'Saving…' : 'Save'}
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="p-4">
          {error && (
            <div className="mb-4 rounded-lg bg-red-500/20 border border-red-500/50 px-4 py-2 text-sm text-red-300">
              {error}
            </div>
          )}
          {itemsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-[#10B981] animate-spin" />
            </div>
          ) : itemsEditMode ? (
            <ul className="space-y-2">
              {itemDraft.map((row) => {
                const meta = packingItems.find((p) => p.id === row.id);
                return (
                  <li
                    key={row.id}
                    className="bg-[#1F2937] border border-[#374151] rounded-lg p-3 space-y-3 min-w-0"
                  >
                    <div>
                      <p className="font-medium text-white truncate">{meta?.product_name ?? '—'}</p>
                      <p className="text-sm text-[#9CA3AF] truncate">SKU: {meta?.sku ?? '—'}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-[#9CA3AF]">Pieces</label>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={row.pieces}
                          onChange={(e) =>
                            updatePackingDraftRow(row.id, { pieces: Math.max(0, Math.floor(Number(e.target.value) || 0)) })
                          }
                          className="w-full h-9 rounded bg-[#111827] border border-[#374151] text-white px-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#9CA3AF]">Cartons</label>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={row.cartons}
                          onChange={(e) =>
                            updatePackingDraftRow(row.id, { cartons: Math.max(0, Math.floor(Number(e.target.value) || 0)) })
                          }
                          className="w-full h-9 rounded bg-[#111827] border border-[#374151] text-white px-2 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-[#9CA3AF]">Weight</label>
                      <input
                        type="text"
                        value={row.weight}
                        onChange={(e) => updatePackingDraftRow(row.id, { weight: e.target.value })}
                        className="w-full h-9 rounded bg-[#111827] border border-[#374151] text-white px-2 text-sm"
                        placeholder="e.g. 12kg"
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <ul className="space-y-2">
              {packingItems.map((item) => (
                <li
                  key={item.id}
                  className="bg-[#1F2937] border border-[#374151] rounded-lg p-3 flex justify-between items-start gap-2 min-w-0"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-white truncate">{item.product_name ?? '—'}</p>
                    <p className="text-sm text-[#9CA3AF] truncate">SKU: {item.sku ?? '—'}</p>
                  </div>
                  <div className="text-right text-sm shrink-0">
                    <p className="text-[#D1D5DB]">Pieces: {item.pieces}</p>
                    <p className="text-[#D1D5DB]">Cartons: {item.cartons}</p>
                    {item.weight ? <p className="text-[#9CA3AF]">Wt: {item.weight}</p> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {packingItems.length === 0 && !itemsLoading && (
            <p className="text-[#9CA3AF] text-sm py-4">No packing items.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
        <div className="flex items-center gap-3 px-4 h-14">
          <button type="button" onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <ListChecks className="w-6 h-6 text-[#10B981]" />
          <h1 className="text-white font-semibold text-base">Packing List</h1>
        </div>
      </div>
      <div className="p-4">
        {error && (
          <div className="mb-4 rounded-lg bg-red-500/20 border border-red-500/50 px-4 py-2 text-sm text-red-300">
            {error}
          </div>
        )}
        <p className="text-sm text-[#9CA3AF] mb-4">Select a sale to create or view packing list.</p>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#10B981] animate-spin" />
          </div>
        ) : (
          <ul className="space-y-2">
            {sales.slice(0, 50).map((sale) => {
              const id = sale.id as string;
              const invoiceNo = (sale.invoice_no as string) ?? '—';
              const customerName = (sale.customer as { name?: string })?.name ?? (sale.customer_name as string) ?? 'Walk-in';
              const total = Number(sale.total ?? 0);
              const hasPacking = getPackingListIdForSale(id) !== null;
              const creating = creatingSaleId === id;
              return (
                <li
                  key={id}
                  className="bg-[#1F2937] border border-[#374151] rounded-lg p-3 flex flex-col gap-2"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-white">{invoiceNo}</p>
                      <p className="text-sm text-[#9CA3AF]">{customerName}</p>
                      <p className="text-sm text-[#D1D5DB]">Rs. {total.toLocaleString()}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShipmentSaleId(id);
                          setShipmentSaleLabel(String(invoiceNo));
                          setShipmentBranchId((sale.branch_id as string) ?? branchId ?? null);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0EA5E9]/20 text-[#7DD3FC] text-sm font-medium"
                      >
                        <Truck className="w-4 h-4" />
                        Shipment
                      </button>
                      {hasPacking ? (
                        <button
                          type="button"
                          onClick={() => handleViewPackingItems(id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#3B82F6]/20 text-[#93C5FD] text-sm font-medium"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={creating}
                          onClick={() => handleCreatePackingList(id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#10B981]/20 text-[#6EE7B7] text-sm font-medium disabled:opacity-50"
                        >
                          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
                          Create
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {shipmentSaleId && companyId && shipmentBranchId && (
        <ShipmentModal
          saleId={shipmentSaleId}
          saleLabel={shipmentSaleLabel ?? undefined}
          companyId={companyId}
          branchId={shipmentBranchId}
          userId={user.id}
          onClose={() => {
            setShipmentSaleId(null);
            setShipmentSaleLabel(null);
            setShipmentBranchId(null);
          }}
        />
      )}
    </div>
  );
}
