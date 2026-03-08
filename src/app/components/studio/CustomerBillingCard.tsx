/**
 * Customer Billing Card (Safe Zone – studio_customer_invoice_v1)
 * Shows production cost, customer price, profit; Generate Sale Invoice or View Invoice.
 * Only render when feature flag studio_customer_invoice_v1 is enabled.
 */

import React, { useState, useEffect } from 'react';
import { FileText, Loader2, ExternalLink, Package } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import {
  getProductionCostSummary,
  generateCustomerInvoiceFromProduction,
  createProductFromProductionOrder,
} from '@/app/services/studioCustomerInvoiceService';
import { useNavigation } from '@/app/context/NavigationContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface CustomerBillingCardProps {
  orderId: string;
  status: string;
  customerInvoiceGenerated?: boolean;
  generatedSaleId?: string | null;
  productId?: string | null;
  companyId?: string | null;
  onInvoiceGenerated?: () => void;
  onProductCreated?: () => void;
}

export const CustomerBillingCard: React.FC<CustomerBillingCardProps> = ({
  orderId,
  status,
  customerInvoiceGenerated = false,
  generatedSaleId,
  productId,
  companyId,
  onInvoiceGenerated,
  onProductCreated,
}) => {
  const { formatCurrency } = useFormatCurrency();
  const { setCurrentView, setOpenSaleIdForView } = useNavigation();
  const { user } = useSupabase();
  const [productionCost, setProductionCost] = useState<number>(0);
  const [customerPrice, setCustomerPrice] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [productNameInput, setProductNameInput] = useState('');
  const [creatingProduct, setCreatingProduct] = useState(false);

  const completed = status === 'completed';
  const profit = customerPrice ? Math.max(0, Number(customerPrice) - productionCost) : 0;

  const [linkedProductName, setLinkedProductName] = useState<string | null>(null);
  const [linkedProductSku, setLinkedProductSku] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getProductionCostSummary(orderId)
      .then((s) => {
        if (!cancelled) {
          setProductionCost(s.productionCost);
          if (!customerPrice && s.productionCost > 0) setCustomerPrice(String(s.productionCost));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [orderId]);

  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    supabase.from('products').select('name, sku').eq('id', productId).maybeSingle().then(({ data }) => {
      if (!cancelled && data) {
        setLinkedProductName((data as any).name);
        setLinkedProductSku((data as any).sku);
      }
    });
    return () => { cancelled = true; };
  }, [productId]);

  const handleGenerate = async () => {
    const price = Number(customerPrice);
    if (!Number.isFinite(price) || price <= 0) {
      toast.error('Enter a valid customer price.');
      return;
    }
    if (!user?.id) {
      toast.error('User session required.');
      return;
    }
    setGenerating(true);
    try {
      const { saleId, invoiceNo } = await generateCustomerInvoiceFromProduction({
        productionOrderId: orderId,
        customerPrice: price,
        createdBy: user.id,
      });
      toast.success(`Invoice ${invoiceNo} created.`);
      onInvoiceGenerated?.();
      if (setOpenSaleIdForView) setOpenSaleIdForView(saleId);
      setCurrentView('sales');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to generate invoice.');
    } finally {
      setGenerating(false);
    }
  };

  const handleViewInvoice = () => {
    if (generatedSaleId && setOpenSaleIdForView) {
      setOpenSaleIdForView(generatedSaleId);
      setCurrentView('sales');
    }
  };

  const handleCreateProduct = async () => {
    if (!companyId) {
      toast.error('Company not found.');
      return;
    }
    const name = (productNameInput || '').trim() || 'Studio Product';
    setCreatingProduct(true);
    try {
      const { sku } = await createProductFromProductionOrder({
        productionOrderId: orderId,
        productName: name,
        companyId,
      });
      toast.success(`Product created (SKU: ${sku}). You can now generate the sale invoice.`);
      onProductCreated?.();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create product.');
    } finally {
      setCreatingProduct(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-700/50 bg-gray-800/30 p-4 flex items-center gap-2 text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading production cost…</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-700/50 bg-gray-800/30 p-4 space-y-4">
      <div className="flex items-center gap-2 text-white font-medium">
        <FileText className="h-5 w-5 text-amber-400" />
        <span>Customer Billing</span>
      </div>

      <div className="grid gap-3 text-sm">
        <div className="flex justify-between text-gray-300">
          <span>Production Cost</span>
          <span className="font-medium text-white">{formatCurrency(productionCost)}</span>
        </div>

        {!customerInvoiceGenerated && completed && (
          <>
            {productId ? (
              <div className="flex items-center gap-2 text-gray-300 py-1">
                <Package className="h-4 w-4 text-amber-500" />
                <span>Product: {linkedProductName || '—'} {linkedProductSku && <span className="text-gray-500">({linkedProductSku})</span>}</span>
              </div>
            ) : (
              <div className="space-y-2 rounded border border-gray-700/50 p-3 bg-gray-900/50">
                <Label className="text-gray-400 text-xs">Create Product (optional – manufactured item for invoice)</Label>
                <Input
                  className="bg-gray-900 border-gray-700 text-white"
                  placeholder="e.g. Bridal Dress – Ayesha"
                  value={productNameInput}
                  onChange={(e) => setProductNameInput(e.target.value)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="border-amber-600 text-amber-200"
                  disabled={creatingProduct}
                  onClick={handleCreateProduct}
                >
                  {creatingProduct ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Package className="h-4 w-4 mr-2" />}
                  Create Product
                </Button>
              </div>
            )}
          </>
        )}

        {!customerInvoiceGenerated && (
          <>
            <div>
              <Label className="text-gray-400 text-xs">Customer Price</Label>
              <Input
                type="number"
                min={0}
                step={1}
                className="mt-1 bg-gray-900 border-gray-700 text-white"
                placeholder="Enter amount"
                value={customerPrice}
                onChange={(e) => setCustomerPrice(e.target.value)}
              />
            </div>
            {customerPrice && Number(customerPrice) > 0 && (
              <div className="flex justify-between text-gray-300">
                <span>Profit</span>
                <span className="font-medium text-green-400">{formatCurrency(profit)}</span>
              </div>
            )}
          </>
        )}
      </div>

      {customerInvoiceGenerated && generatedSaleId ? (
        <Button
          variant="outline"
          size="sm"
          className="border-amber-600 text-amber-200 w-full sm:w-auto"
          onClick={handleViewInvoice}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          View Invoice
        </Button>
      ) : (
        <Button
          size="sm"
          className="bg-amber-600 hover:bg-amber-700 text-white w-full sm:w-auto"
          disabled={!completed || generating || !customerPrice || Number(customerPrice) <= 0}
          onClick={handleGenerate}
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : null}
          Generate Sale Invoice
        </Button>
      )}

      {!completed && !customerInvoiceGenerated && (
        <p className="text-xs text-gray-500">Complete production to generate the customer invoice.</p>
      )}
    </div>
  );
};
