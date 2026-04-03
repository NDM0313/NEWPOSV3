import { useState, useEffect } from 'react';
import { ArrowLeft, Package, Loader2, ListChecks, Eye, Truck } from 'lucide-react';
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
  const [, setSelectedPackingListId] = useState<string | null>(null);
  const [packingItems, setPackingItems] = useState<packingListApi.PackingListItemRow[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
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
      setSelectedPackingListId(data.id);
      setPackingItems(data.items || []);
      setView('items');
    }
  };

  const handleViewPackingItems = async (saleId: string) => {
    const plId = salePackingMap[saleId];
    if (plId) {
      setSelectedPackingListId(plId);
      setView('items');
      setItemsLoading(true);
      const { data } = await packingListApi.getPackingListWithItems(plId);
      setItemsLoading(false);
      if (data?.items) setPackingItems(data.items);
      return;
    }
    const { data } = await packingListApi.listPackingListsBySale(saleId);
    if (data?.length) {
      const first = data[0];
      setSalePackingMap((prev) => ({ ...prev, [saleId]: first.id }));
      setSelectedPackingListId(first.id);
      setView('items');
      setItemsLoading(true);
      const res = await packingListApi.getPackingListWithItems(first.id);
      setItemsLoading(false);
      if (res.data?.items) setPackingItems(res.data.items);
    } else {
      setError('No packing list found for this sale.');
    }
  };

  const getPackingListIdForSale = (saleId: string): string | null => salePackingMap[saleId] ?? null;

  if (view === 'items') {
    return (
      <div className="min-h-screen bg-[#111827] pb-24">
        <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
          <div className="flex items-center gap-3 px-4 h-14">
            <button type="button" onClick={() => setView('sales')} className="p-2 hover:bg-[#374151] rounded-lg text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Package className="w-6 h-6 text-[#10B981]" />
            <h1 className="text-white font-semibold text-base">Packing Items</h1>
          </div>
        </div>
        <div className="p-4">
          {itemsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-[#10B981] animate-spin" />
            </div>
          ) : (
            <ul className="space-y-2">
              {packingItems.map((item) => (
                <li
                  key={item.id}
                  className="bg-[#1F2937] border border-[#374151] rounded-lg p-3 flex justify-between items-start gap-2"
                >
                  <div>
                    <p className="font-medium text-white">{item.product_name ?? '—'}</p>
                    <p className="text-sm text-[#9CA3AF]">SKU: {item.sku ?? '—'}</p>
                  </div>
                  <div className="text-right text-sm">
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
