/**
 * Step 6: Quotation workflow. List, create, print quotation, generate proforma, convert to sale.
 */
import React, { useState, useEffect } from 'react';
import { quotationService, quotationToQuotationDocument, quotationToProformaDocument } from '@/app/services/quotationService';
import type { QuotationRow } from '@/app/services/quotationService';
import { UnifiedQuotationView } from '@/app/documents';
import { UnifiedProformaInvoiceView } from '@/app/documents';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { FileText, Plus, Printer, FileCheck, Loader2, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { toast } from 'sonner';

export interface QuotationWorkflowProps {
  companyId: string;
  companyName: string;
  companyAddress?: string | null;
  isOpen: boolean;
  onClose: () => void;
  onConvertToSale?: (saleId: string) => void;
}

interface DraftItem {
  product_name: string;
  sku: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
}

export const QuotationWorkflow: React.FC<QuotationWorkflowProps> = ({
  companyId,
  companyName,
  companyAddress,
  isOpen,
  onClose,
  onConvertToSale,
}) => {
  const [list, setList] = useState<QuotationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [draftItems, setDraftItems] = useState<DraftItem[]>([{ product_name: '', sku: '', quantity: 0, unit: 'pcs', unit_price: 0, discount_amount: 0, tax_amount: 0, total: 0 }]);
  const [saving, setSaving] = useState(false);
  const [printQuotation, setPrintQuotation] = useState<QuotationRow | null>(null);
  const [printProforma, setPrintProforma] = useState<QuotationRow | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const data = await quotationService.listByCompany(companyId, { limit: 100 });
      const withItems = await Promise.all(data.map((q) => quotationService.getById(q.id, true)));
      setList(withItems.filter(Boolean) as QuotationRow[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load quotations');
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && companyId) load();
  }, [isOpen, companyId]);

  const handleCreate = async () => {
    const name = customerName.trim() || 'Customer';
    const items = draftItems.filter((i) => (i.product_name || i.sku) && Number(i.quantity) > 0);
    if (items.length === 0) {
      toast.error('Add at least one item');
      return;
    }
    const withTotals = items.map((i) => {
      const total = i.quantity * i.unit_price - (i.discount_amount || 0) + (i.tax_amount || 0);
      return { ...i, total: i.total || total };
    });
    setSaving(true);
    try {
      await quotationService.create({
        companyId,
        customerName: name,
        items: withTotals.map((it) => ({
          product_name: it.product_name,
          sku: it.sku,
          quantity: it.quantity,
          unit: it.unit,
          unit_price: it.unit_price,
          discount_amount: it.discount_amount,
          tax_amount: it.tax_amount,
          total: it.total,
        })),
      });
      toast.success('Quotation created');
      setCreateOpen(false);
      setCustomerName('');
      setDraftItems([{ product_name: '', sku: '', quantity: 0, unit: 'pcs', unit_price: 0, discount_amount: 0, tax_amount: 0, total: 0 }]);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create quotation');
    } finally {
      setSaving(false);
    }
  };

  const addRow = () => setDraftItems((prev) => [...prev, { product_name: '', sku: '', quantity: 0, unit: 'pcs', unit_price: 0, discount_amount: 0, tax_amount: 0, total: 0 }]);
  const updateRow = (idx: number, field: keyof DraftItem, value: string | number) => {
    setDraftItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      if (field === 'quantity' || field === 'unit_price') {
        const q = Number(next[idx].quantity) || 0;
        const p = Number(next[idx].unit_price) || 0;
        next[idx].total = q * p - (next[idx].discount_amount || 0) + (next[idx].tax_amount || 0);
      }
      return next;
    });
  };

  const handleConvert = async (q: QuotationRow) => {
    setConvertingId(q.id);
    try {
      const { saleId } = await quotationService.convertToSale(q.id);
      toast.success('Converted to sale');
      onConvertToSale?.(saleId);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Convert failed');
    } finally {
      setConvertingId(null);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Quotations
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-end mb-4">
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              New Quotation
            </Button>
          </div>
          {loading ? (
            <div className="py-8 text-center text-gray-500">Loading…</div>
          ) : list.length === 0 ? (
            <div className="py-8 text-center text-gray-500">No quotations. Create one to get started.</div>
          ) : (
            <ul className="space-y-2">
              {list.map((q) => (
                <li key={q.id} className="flex items-center justify-between rounded border p-3 text-sm">
                  <div>
                    <span className="font-medium">{q.quotation_no}</span>
                    <span className="text-gray-500 ml-2">{q.customer_name}</span>
                    <span className="text-gray-400 ml-2">{q.status}</span>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {q.status !== 'converted' && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => setPrintQuotation(q)} className="gap-1">
                          <Printer className="h-3 w-3" />
                          Print
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setPrintProforma(q)} className="gap-1">
                          <FileCheck className="h-3 w-3" />
                          Proforma
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleConvert(q)} disabled={convertingId === q.id} className="gap-1">
                          {convertingId === q.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
                          Convert to Sale
                        </Button>
                      </>
                    )}
                    {q.status === 'converted' && (
                      <span className="text-gray-500 text-xs">Converted</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Quotation */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>New Quotation</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Customer name</Label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name" className="mt-1" />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <Label>Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={addRow}>Add row</Button>
              </div>
              <div className="border rounded overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left p-2">Product</th>
                      <th className="text-left p-2">SKU</th>
                      <th className="text-right p-2">Qty</th>
                      <th className="text-left p-2">Unit</th>
                      <th className="text-right p-2">Price</th>
                      <th className="text-right p-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draftItems.map((row, idx) => (
                      <tr key={idx}>
                        <td className="p-1"><Input value={row.product_name} onChange={(e) => updateRow(idx, 'product_name', e.target.value)} className="h-8" placeholder="Name" /></td>
                        <td className="p-1"><Input value={row.sku} onChange={(e) => updateRow(idx, 'sku', e.target.value)} className="h-8 w-24" placeholder="SKU" /></td>
                        <td className="p-1"><Input type="number" step="0.01" value={row.quantity || ''} onChange={(e) => updateRow(idx, 'quantity', parseFloat(e.target.value) || 0)} className="h-8 w-16 text-right" /></td>
                        <td className="p-1"><Input value={row.unit} onChange={(e) => updateRow(idx, 'unit', e.target.value)} className="h-8 w-16" /></td>
                        <td className="p-1"><Input type="number" step="0.01" value={row.unit_price || ''} onChange={(e) => updateRow(idx, 'unit_price', parseFloat(e.target.value) || 0)} className="h-8 w-20 text-right" /></td>
                        <td className="p-1 text-right">{row.total?.toFixed(2) ?? '0'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={saving} className="gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Save Quotation</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Print Quotation */}
      {printQuotation && (
        <Dialog open={!!printQuotation} onOpenChange={(open) => !open && setPrintQuotation(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto print:max-w-none">
            <DialogHeader className="sr-only">
              <DialogTitle>Print quotation</DialogTitle>
            </DialogHeader>
            <UnifiedQuotationView
              document={quotationToQuotationDocument(printQuotation, companyName, companyAddress)}
              companyId={companyId}
              onClose={() => setPrintQuotation(null)}
              showPrintAction
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Print Proforma */}
      {printProforma && (
        <Dialog open={!!printProforma} onOpenChange={(open) => !open && setPrintProforma(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto print:max-w-none">
            <DialogHeader className="sr-only">
              <DialogTitle>Print proforma invoice</DialogTitle>
            </DialogHeader>
            <UnifiedProformaInvoiceView
              document={quotationToProformaDocument(printProforma, { id: companyId, name: companyName, address: companyAddress ?? null })}
              companyId={companyId}
              onClose={() => setPrintProforma(null)}
              showPrintAction
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};
