import { useState } from 'react';
import type { User } from '../../types';
import type { PackingDetails } from '../transactions/PackingEntryModal';
import { useResponsive } from '../../hooks/useResponsive';
import * as salesApi from '../../api/sales';
import { getBranches } from '../../api/branches';
import { addPending } from '../../lib/offlineStore';
import { SalesHome } from './SalesHome';
import { SelectCustomer } from './SelectCustomer';
import { SelectCustomerTablet } from './SelectCustomerTablet';
import { AddProducts } from './AddProducts';
import { SaleSummary } from './SaleSummary';
import { PaymentDialog } from './PaymentDialog';
import { SaleConfirmation } from './SaleConfirmation';

export type SalesStep = 'home' | 'customer' | 'products' | 'summary' | 'payment' | 'confirmation';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  balance: number;
}

export interface Product {
  id: string;
  name: string;
  sku?: string;
  price: number;
  quantity: number;
  /** Display label for selected variation (e.g. "M / Red") */
  variation?: string;
  /** Backend variation_id for product_variations */
  variationId?: string;
  total: number;
  packingDetails?: PackingDetails;
}

export interface SaleData {
  customer: Customer | null;
  products: Product[];
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  notes: string;
  saleType: 'regular' | 'studio';
}

interface SalesModuleProps {
  onBack: () => void;
  user: User;
  companyId: string | null;
  branchId: string | null;
  initialSaleType?: 'regular' | 'studio';
}

export function SalesModule({ onBack, user, companyId, branchId, initialSaleType }: SalesModuleProps) {
  const responsive = useResponsive();
  const [step, setStep] = useState<SalesStep>(initialSaleType === 'studio' ? 'customer' : 'home');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [createdInvoiceNo, setCreatedInvoiceNo] = useState<string | null>(null);
  const [saleData, setSaleData] = useState<SaleData>({
    customer: null,
    products: [],
    subtotal: 0,
    discount: 0,
    shipping: 0,
    tax: 0,
    total: 0,
    notes: '',
    saleType: initialSaleType === 'studio' ? 'studio' : 'regular',
  });

  const handleStepBack = () => {
    if (step === 'customer') setStep('home');
    else if (step === 'products') setStep('customer');
    else if (step === 'summary') setStep('products');
    else if (step === 'payment') setStep('summary');
    else if (step === 'confirmation') setStep('home');
    else onBack();
  };

  const handleNewSale = () => setStep('customer');
  const handleCustomerSelect = (customer: Customer, saleType: 'regular' | 'studio') => {
    setSaleData((prev) => ({ ...prev, customer, saleType }));
    setStep('products');
  };
  const handleProductsUpdate = (products: Product[]) => {
    const subtotal = products.reduce((sum, p) => sum + p.total, 0);
    setSaleData((prev) => ({ ...prev, products, subtotal, total: subtotal - prev.discount + prev.shipping + prev.tax }));
  };
  const handleNextToSummary = () => setStep('summary');
  const handleSummaryUpdate = (data: Partial<SaleData>) => {
    setSaleData((prev) => {
      const next = { ...prev, ...data };
      next.total = next.subtotal - next.discount + next.shipping + next.tax;
      return next;
    });
  };
  const handleProceedToPayment = () => {
    setSaveError(null);
    setStep('payment');
  };
  const handlePaymentComplete = async (result: { paymentMethod: string; paidAmount?: number; dueAmount?: number; accountId?: string | null; accountName?: string | null }) => {
    if (!companyId || !user?.id) {
      setSaveError('Company or user missing.');
      return;
    }
    const paid = result.paidAmount ?? 0;
    if (paid > 0 && !result.accountId) {
      setSaveError('Please select a payment account for accounting.');
      return;
    }
    // When "All Branches" selected, use first branch (RPC requires valid UUID)
    let effectiveBranchId = branchId && branchId !== 'all' ? branchId : null;
    if (!effectiveBranchId && companyId) {
      const { data: branches } = await getBranches(companyId);
      effectiveBranchId = branches?.[0]?.id ?? null;
    }
    if (!effectiveBranchId) {
      setSaveError('Please select a specific branch to create sales.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    const items = saleData.products.map((p) => ({
      productId: p.id,
      variationId: p.variationId,
      productName: p.name,
      sku: p.sku ?? '—',
      quantity: p.quantity,
      unitPrice: p.price,
      total: p.total,
      packingDetails: p.packingDetails && (p.packingDetails.total_meters ?? 0) > 0
        ? { total_boxes: p.packingDetails.total_boxes, total_pieces: p.packingDetails.total_pieces }
        : undefined,
    }));
    const salePayload = {
      companyId,
      branchId: effectiveBranchId,
      customerId: saleData.customer?.id ?? null,
      customerName: saleData.customer?.name ?? 'Walk-in',
      contactNumber: saleData.customer?.phone,
      items,
      subtotal: saleData.subtotal,
      discountAmount: saleData.discount,
      taxAmount: 0,
      expenses: saleData.shipping,
      total: saleData.total,
      paymentMethod: result.paymentMethod,
      paidAmount: result.paidAmount,
      dueAmount: result.dueAmount,
      paymentAccountId: result.accountId ?? undefined,
      notes: saleData.notes || undefined,
      isStudio: saleData.saleType === 'studio',
      userId: user.id,
    };

    if (!navigator.onLine) {
      try {
        await addPending('sale', salePayload, companyId, effectiveBranchId);
        setCreatedInvoiceNo('Pending sync');
        setStep('confirmation');
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : 'Failed to save offline.');
      }
      setSaving(false);
      return;
    }

    const { data, error } = await salesApi.createSale(salePayload);
    setSaving(false);
    if (error) {
      setSaveError(error);
      return;
    }
    setCreatedInvoiceNo(data?.invoiceNo ?? null);
    setStep('confirmation');
  };
  const handleNewSaleFromConfirmation = () => {
    setCreatedInvoiceNo(null);
    setSaleData({
      customer: null,
      products: [],
      subtotal: 0,
      discount: 0,
      shipping: 0,
      tax: 0,
      total: 0,
      notes: '',
      saleType: 'regular',
    });
    setStep('customer');
  };
  const handleBackToHome = () => {
    setCreatedInvoiceNo(null);
    setSaleData({
      customer: null,
      products: [],
      subtotal: 0,
      discount: 0,
      shipping: 0,
      tax: 0,
      total: 0,
      notes: '',
      saleType: 'regular',
    });
    onBack();
  };

  if (step === 'home') return <SalesHome onBack={onBack} onNewSale={handleNewSale} companyId={companyId} branchId={branchId} userId={user?.id ?? null} />;
  if (step === 'customer') {
    if (responsive.isTablet) {
      return (
        <SelectCustomerTablet
          companyId={companyId}
          onBack={handleStepBack}
          onSelect={handleCustomerSelect}
          initialSaleType={saleData.saleType}
          onSaleTypeChange={(st) => setSaleData((prev) => ({ ...prev, saleType: st }))}
        />
      );
    }
    return (
      <SelectCustomer
        companyId={companyId}
        onBack={handleStepBack}
        onSelect={handleCustomerSelect}
        initialSaleType={saleData.saleType}
        onSaleTypeChange={(st) => setSaleData((prev) => ({ ...prev, saleType: st }))}
      />
    );
  }
  if (step === 'products' && saleData.customer)
    return (
      <AddProducts
        companyId={companyId}
        onBack={handleStepBack}
        customer={saleData.customer}
        initialProducts={saleData.products}
        onProductsUpdate={handleProductsUpdate}
        onNext={handleNextToSummary}
      />
    );
  if (step === 'summary') return <SaleSummary onBack={handleStepBack} saleData={saleData} onUpdate={handleSummaryUpdate} onProceedToPayment={handleProceedToPayment} />;
  if (step === 'payment')
    return (
      <PaymentDialog
        onBack={handleStepBack}
        totalAmount={saleData.total}
        companyId={companyId}
        onComplete={handlePaymentComplete}
        saving={saving}
        saveError={saveError}
      />
    );
  if (step === 'confirmation')
    return (
      <SaleConfirmation
        saleData={saleData}
        invoiceNo={createdInvoiceNo}
        onNewSale={handleNewSaleFromConfirmation}
        onBackToHome={handleBackToHome}
      />
    );
  return null;
}
