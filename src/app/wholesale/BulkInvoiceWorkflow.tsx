/**
 * Wholesale: Bulk Invoice workflow (Step 5).
 * Select multiple packing lists → Generate Bulk Invoice → Print via UnifiedSalesInvoiceView.
 */
import React, { useState, useEffect } from 'react';
import { packingListService, type PackingListRow } from '@/app/services/packingListService';
import { bulkInvoiceService, type BulkInvoiceRow } from '@/app/services/bulkInvoiceService';
import { UnifiedSalesInvoiceView } from '@/app/documents';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { FileText, Printer, Loader2, CheckSquare, Square } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { toast } from 'sonner';

export interface BulkInvoiceWorkflowProps {
  companyId: string;
  companyName: string;
  companyAddress?: string | null;
  isOpen: boolean;
  onClose: () => void;
  onGenerated?: () => void;
}

export const BulkInvoiceWorkflow: React.FC<BulkInvoiceWorkflowProps> = ({
  companyId,
  companyName,
  companyAddress,
  isOpen,
  onClose,
  onGenerated,
}) => {
  const [packingLists, setPackingLists] = useState<PackingListRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [customerName, setCustomerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [bulkInvoiceId, setBulkInvoiceId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !companyId) return;
    setLoading(true);
    packingListService
      .listByCompany(companyId, { limit: 100 })
      .then(async (list) => {
        const withItems = await Promise.all(list.map((pl) => packingListService.getById(pl.id, true)));
        setPackingLists(withItems.filter(Boolean) as PackingListRow[]);
      })
      .catch(() => setPackingLists([]))
      .finally(() => setLoading(false));
  }, [isOpen, companyId]);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleGenerate = async () => {
    if (selectedIds.size === 0) {
      toast.error('Select at least one packing list');
      return;
    }
    setCreating(true);
    try {
      const bulk = await bulkInvoiceService.createFromPackingLists({
        companyId,
        packingListIds: Array.from(selectedIds),
        customerName: customerName.trim() || 'Customer',
      });
      toast.success(`Bulk invoice ${bulk.invoice_no} created`);
      onGenerated?.();
      setBulkInvoiceId(bulk.id);
      setSelectedIds(new Set());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create bulk invoice');
    } finally {
      setCreating(false);
    }
  };

  const docPromise = bulkInvoiceId && companyId
    ? bulkInvoiceService.getInvoiceDocument(bulkInvoiceId, {
        id: companyId,
        name: companyName,
        address: companyAddress ?? null,
      })
    : null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { onClose(); setBulkInvoiceId(null); } }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Bulk Invoice
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">Select packing lists to combine into one invoice.</p>

          <div className="mt-3">
            <Label>Customer name</Label>
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Customer name for invoice"
              className="mt-1"
            />
          </div>

          {loading ? (
            <div className="py-4 text-center text-sm text-gray-500">Loading packing lists…</div>
          ) : packingLists.length === 0 ? (
            <div className="py-4 text-center text-sm text-gray-500">No packing lists found. Create packing lists from Sales first.</div>
          ) : (
            <ul className="mt-3 max-h-48 overflow-auto space-y-1 border rounded p-2">
              {packingLists.map((pl) => (
                <li
                  key={pl.id}
                  className="flex items-center gap-2 text-sm cursor-pointer rounded p-2 hover:bg-gray-50"
                  onClick={() => toggle(pl.id)}
                >
                  {selectedIds.has(pl.id) ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4" />}
                  <span>Sale {pl.sale_id?.slice(0, 8)}… · {pl.created_at?.slice(0, 10)} · {pl.status}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleGenerate} disabled={creating || selectedIds.size === 0} className="gap-2">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Generate Bulk Invoice
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {bulkInvoiceId && (
        <BulkInvoicePrintDialog
          bulkInvoiceId={bulkInvoiceId}
          companyId={companyId}
          companyName={companyName}
          companyAddress={companyAddress}
          onClose={() => setBulkInvoiceId(null)}
        />
      )}
    </>
  );
};

/** Internal: modal that loads bulk invoice document and renders UnifiedSalesInvoiceView. */
function BulkInvoicePrintDialog({
  bulkInvoiceId,
  companyId,
  companyName,
  companyAddress,
  onClose,
}: {
  bulkInvoiceId: string;
  companyId: string;
  companyName: string;
  companyAddress?: string | null;
  onClose: () => void;
}) {
  const [doc, setDoc] = useState<Awaited<ReturnType<typeof bulkInvoiceService.getInvoiceDocument>>>(null);
  useEffect(() => {
    bulkInvoiceService
      .getInvoiceDocument(bulkInvoiceId, { id: companyId, name: companyName, address: companyAddress ?? null })
      .then(setDoc);
  }, [bulkInvoiceId, companyId, companyName, companyAddress]);

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto print:max-w-none">
        <DialogHeader className="sr-only">
          <DialogTitle>Bulk invoice</DialogTitle>
        </DialogHeader>
        {!doc ? (
          <div className="flex items-center justify-center p-8 text-gray-500">Loading invoice…</div>
        ) : (
          <UnifiedSalesInvoiceView
            document={doc}
            companyId={companyId}
            templateType="A4"
            onClose={onClose}
            showPrintAction
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
