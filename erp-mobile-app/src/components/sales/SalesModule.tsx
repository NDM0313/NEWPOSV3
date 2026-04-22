import { useState, useCallback } from 'react';
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
import { StudioDetailsStep, type StudioDetailsData } from './StudioDetailsStep';
import { TransactionSuccessModal, type TransactionSuccessData } from '../shared/TransactionSuccessModal';
import { getMobilePrinterSettings } from '../../api/settings';
import { formatPlainReceiptLines, printThermalReceiptLines } from '../../services/thermalPrint';

export type SalesStep = 'home' | 'customer' | 'products' | 'studioDetails' | 'summary' | 'payment' | 'confirmation';

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
  /** Studio only: order date (YYYY-MM-DD), deadline (YYYY-MM-DD), production notes */
  orderDate?: string;
  deadlineDate?: string;
  productionNotes?: string;
}

interface SalesModuleProps {
  onBack: () => void;
  user: User;
  companyId: string | null;
  /** From App branch context only; do not compute inside Payment. */
  branchId: string | null;
  initialSaleType?: 'regular' | 'studio';
  /** If provided, completing a studio sale navigates to the Studio module with the new sale focused. */
  onOpenStudio?: (saleId: string) => void;
}

export function SalesModule({ onBack, user, companyId, branchId, initialSaleType, onOpenStudio }: SalesModuleProps) {
  const responsive = useResponsive();
  const [step, setStep] = useState<SalesStep>(initialSaleType === 'studio' ? 'customer' : 'home');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [createdInvoiceNo, setCreatedInvoiceNo] = useState<string | null>(null);
  const [createdSaleId, setCreatedSaleId] = useState<string | null>(null);
  const [confirmationData, setConfirmationData] = useState<TransactionSuccessData | null>(null);
  const todayStr = () => new Date().toISOString().split('T')[0];
  const todayPlus7Str = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  };
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
    orderDate: todayStr(),
    deadlineDate: todayPlus7Str(),
    productionNotes: '',
  });

  const handleStepBack = () => {
    if (step === 'customer') setStep('home');
    else if (step === 'products') setStep('customer');
    else if (step === 'studioDetails') setStep('products');
    else if (step === 'summary') setStep(saleData.saleType === 'studio' ? 'studioDetails' : 'products');
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
  const handleNextFromProducts = () => {
    if (saleData.saleType === 'studio') setStep('studioDetails');
    else setStep('summary');
  };
  const handleStudioDetailsNext = (data: StudioDetailsData) => {
    setSaleData((prev) => ({ ...prev, ...data }));
    setStep('summary');
  };
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
      notes: saleData.saleType === 'studio' ? (saleData.productionNotes || saleData.notes || undefined) : (saleData.notes || undefined),
      isStudio: saleData.saleType === 'studio',
      userId: user.id,
      ...(saleData.saleType === 'studio' && {
        orderDate: saleData.orderDate || undefined,
        deadline: saleData.deadlineDate || undefined,
      }),
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
    setCreatedSaleId(data?.id ?? null);
    let branchName: string | null = null;
    if (companyId) {
      const { data: branches } = await getBranches(companyId);
      branchName = branches?.find((b) => b.id === effectiveBranchId)?.name ?? null;
    }
    setConfirmationData({
      type: 'sale',
      title: 'Sale Saved Successfully',
      transactionNo: data?.invoiceNo ?? null,
      amount: saleData.total,
      partyName: saleData.customer?.name ?? 'Walk-in',
      date: new Date().toISOString(),
      branch: branchName ?? undefined,
      entityId: data?.id ?? null,
    });
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
      orderDate: todayStr(),
      deadlineDate: todayPlus7Str(),
      productionNotes: '',
    });
    setStep('customer');
  };
  const handleBackToHome = () => {
    setCreatedInvoiceNo(null);
    setCreatedSaleId(null);
    setConfirmationData(null);
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
      orderDate: todayStr(),
      deadlineDate: todayPlus7Str(),
      productionNotes: '',
    });
    onBack();
  };

  const handleThermalPrint = useCallback(async () => {
    const data = confirmationData;
    if (!companyId || !data) return;
    const { data: settings } = await getMobilePrinterSettings(companyId);
    if (settings.mode !== 'thermal') {
      window.alert('Set printer mode to Thermal in Settings → Printer, or use Share slip.');
      return;
    }
    const lines = formatPlainReceiptLines({
      title: 'SALE RECEIPT',
      transactionNo: data.transactionNo,
      partyName: data.partyName,
      amount: data.amount ?? null,
      date: data.date,
      branch: data.branch,
    });
    const res = await printThermalReceiptLines(lines);
    if (!res.ok && res.hint) window.alert(res.hint);
  }, [companyId, confirmationData]);

  const closeSuccessModal = () => {
    const wasStudio = saleData.saleType === 'studio';
    const studioSaleId = createdSaleId;
    setConfirmationData(null);
    setCreatedSaleId(null);
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
      orderDate: todayStr(),
      deadlineDate: todayPlus7Str(),
      productionNotes: '',
    });
    if (wasStudio && studioSaleId && onOpenStudio) {
      onOpenStudio(studioSaleId);
      return;
    }
    setStep('home');
  };

  const handleSuccessNewSale = () => {
    setConfirmationData(null);
    setCreatedSaleId(null);
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
      orderDate: todayStr(),
      deadlineDate: todayPlus7Str(),
      productionNotes: '',
    });
    setStep('customer');
  };

  return (
    <>
      {step === 'home' && <SalesHome onBack={onBack} onNewSale={handleNewSale} companyId={companyId} branchId={branchId} userId={user?.id ?? null} />}
      {step === 'customer' && (responsive.isTablet ? (
        <SelectCustomerTablet
          companyId={companyId}
          onBack={handleStepBack}
          onSelect={handleCustomerSelect}
          initialSaleType={saleData.saleType}
          onSaleTypeChange={(st) => setSaleData((prev) => ({ ...prev, saleType: st }))}
        />
      ) : (
        <SelectCustomer
          companyId={companyId}
          onBack={handleStepBack}
          onSelect={handleCustomerSelect}
          initialSaleType={saleData.saleType}
          onSaleTypeChange={(st) => setSaleData((prev) => ({ ...prev, saleType: st }))}
        />
      ))}
      {step === 'products' && saleData.customer && (
        <AddProducts
          companyId={companyId}
          onBack={handleStepBack}
          customer={saleData.customer}
          initialProducts={saleData.products}
          onProductsUpdate={handleProductsUpdate}
          onNext={handleNextFromProducts}
        />
      )}
      {step === 'studioDetails' && (
        <StudioDetailsStep
          onBack={handleStepBack}
          initialData={{
            orderDate: saleData.orderDate || new Date().toISOString().split('T')[0],
            deadlineDate: saleData.deadlineDate || (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().split('T')[0]; })(),
            productionNotes: saleData.productionNotes || '',
          }}
          onNext={handleStudioDetailsNext}
        />
      )}
      {step === 'summary' && <SaleSummary onBack={handleStepBack} saleData={saleData} onUpdate={handleSummaryUpdate} onProceedToPayment={handleProceedToPayment} />}
      {step === 'payment' && (
        !branchId
          ? (
            <div className="min-h-[50vh] flex flex-col items-center justify-center p-6">
              <p className="text-[#EF4444] text-center font-medium mb-4">No branch assigned. Contact admin.</p>
              <button type="button" onClick={handleStepBack} className="px-4 py-2 bg-[#3B82F6] text-white rounded-lg font-medium">Go back</button>
            </div>
            )
          : (
            <PaymentDialog
              onBack={handleStepBack}
              totalAmount={saleData.total}
              companyId={companyId}
              onComplete={handlePaymentComplete}
              saving={saving}
              saveError={saveError}
              hasCustomer={!!saleData.customer?.id}
            />
            )
      )}
      {step === 'confirmation' && (
        <SaleConfirmation
          saleData={saleData}
          invoiceNo={createdInvoiceNo}
          onNewSale={handleNewSaleFromConfirmation}
          onBackToHome={handleBackToHome}
        />
      )}

      <TransactionSuccessModal
        isOpen={confirmationData != null}
        data={confirmationData}
        onClose={closeSuccessModal}
        onShareSlip={closeSuccessModal}
        onViewInvoice={closeSuccessModal}
        onThermalPrint={handleThermalPrint}
        onNewSale={handleSuccessNewSale}
        onHome={handleBackToHome}
      />
    </>
  );
}
