/**
 * Wholesale: Packing List workflow (Step 5).
 * From a sale: list packing lists, Generate new, Print via UnifiedPackingListView.
 */
import React, { useState, useEffect } from 'react';
import { packingListService, type PackingListRow } from '@/app/services/packingListService';
import { UnifiedPackingListView } from '@/app/documents';
import { CourierShipmentWorkflow } from '@/app/wholesale/CourierShipmentWorkflow';
import type { PackingListDocument } from '@/app/documents/templates/PackingListTemplate';
import { Button } from '@/app/components/ui/button';
import { Package, Printer, Plus, Truck, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { toast } from 'sonner';

export interface PackingListWorkflowProps {
  saleId: string;
  saleInvoiceNo: string;
  saleDate: string;
  companyId: string;
  companyName: string;
  companyAddress?: string | null;
  customerName?: string;
  customerAddress?: string | null;
  customerPhone?: string | null;
  isOpen: boolean;
  onClose: () => void;
  onGenerated?: () => void;
}

function buildPackingListDocument(pl: PackingListRow, orderNo: string, date: string, companyName: string, companyAddress?: string | null): PackingListDocument {
  const items = (pl.items || []).map((it) => ({
    product: it.product_name || '—',
    sku: it.sku || '',
    pieces: Number(it.pieces) || 0,
    cartons: Number(it.cartons) || 0,
    weight: it.weight || '',
  }));
  const totalPieces = items.reduce((s, i) => s + i.pieces, 0);
  const totalCartons = items.reduce((s, i) => s + i.cartons, 0);
  const totalWeight = items.reduce((s, i) => {
    const w = parseFloat(String(i.weight).replace(/[^\d.-]/g, ''));
    return s + (Number.isFinite(w) ? w : 0);
  }, 0);
  return {
    companyName,
    companyAddress: companyAddress ?? null,
    orderNo,
    date,
    items,
    totalPieces,
    totalCartons,
    totalWeight: totalWeight > 0 ? `${totalWeight} kg` : '',
  };
}

export const PackingListWorkflow: React.FC<PackingListWorkflowProps> = ({
  saleId,
  saleInvoiceNo,
  saleDate,
  companyId,
  companyName,
  companyAddress,
  customerName = '',
  customerAddress,
  customerPhone,
  isOpen,
  onClose,
  onGenerated,
}) => {
  const [lists, setLists] = useState<PackingListRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [printDoc, setPrintDoc] = useState<PackingListDocument | null>(null);
  const [shipmentPackingListId, setShipmentPackingListId] = useState<string | null>(null);

  const load = async () => {
    if (!saleId) return;
    setLoading(true);
    try {
      const data = await packingListService.listBySale(saleId);
      const withItems = await Promise.all(data.map((pl) => packingListService.getById(pl.id, true)));
      setLists(withItems.filter(Boolean) as PackingListRow[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load packing lists');
      setLists([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && saleId) load();
  }, [isOpen, saleId]);

  const handleGenerate = async () => {
    setCreating(true);
    try {
      await packingListService.createFromSale({ companyId, saleId });
      toast.success('Packing list created');
      onGenerated?.();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create packing list');
    } finally {
      setCreating(false);
    }
  };

  const handlePrint = (pl: PackingListRow) => {
    const doc = buildPackingListDocument(pl, saleInvoiceNo, saleDate, companyName, companyAddress);
    setPrintDoc(doc);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Packing List
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Sale: {saleInvoiceNo} · {saleDate}
          </p>
          <div className="flex justify-between items-center mt-2">
            <Button onClick={handleGenerate} disabled={creating} className="gap-2">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Generate Packing List
            </Button>
          </div>
          {loading ? (
            <div className="py-4 text-center text-sm text-gray-500">Loading…</div>
          ) : lists.length === 0 ? (
            <div className="py-4 text-center text-sm text-gray-500">No packing lists yet. Generate one from this sale.</div>
          ) : (
            <ul className="space-y-2 max-h-60 overflow-auto">
              {lists.map((pl) => (
                <li key={pl.id} className="flex items-center justify-between gap-2 rounded border p-2 text-sm">
                  <span>
                    {pl.status} · {pl.created_at?.slice(0, 10)}
                  </span>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => setShipmentPackingListId(pl.id)} className="gap-1">
                      <Truck className="h-3 w-3" />
                      Shipment
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handlePrint(pl)} className="gap-1">
                      <Printer className="h-3 w-3" />
                      Print
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      {printDoc && (
        <Dialog open={!!printDoc} onOpenChange={(open) => !open && setPrintDoc(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto print:max-w-none">
            <UnifiedPackingListView
              document={printDoc}
              companyId={companyId}
              onClose={() => setPrintDoc(null)}
              showPrintAction={true}
            />
          </DialogContent>
        </Dialog>
      )}

      {shipmentPackingListId && (
        <CourierShipmentWorkflow
          packingListId={shipmentPackingListId}
          companyId={companyId}
          companyName={companyName}
          companyAddress={companyAddress}
          orderNo={saleInvoiceNo}
          customerName={customerName}
          customerAddress={customerAddress}
          customerPhone={customerPhone}
          isOpen={!!shipmentPackingListId}
          onClose={() => setShipmentPackingListId(null)}
        />
      )}
    </>
  );
};
