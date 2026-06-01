import { useState, useCallback, useEffect } from 'react';
import type { User } from '../../types';
import type { PackingDetails } from '../transactions/PackingEntryModal';
import { useResponsive } from '../../hooks/useResponsive';
import * as salesApi from '../../api/sales';
import { addPending } from '../../lib/offlineStore';
import { useWriteBranchSelection } from '../../hooks/useWriteBranchSelection';
import { useDocumentBranchGate } from '../../hooks/useDocumentBranchGate';
import { DocumentBranchGateModal } from '../shared/DocumentBranchGateModal';
import { SalesHome } from './SalesHome';
import { SelectCustomer } from './SelectCustomer';
import { SelectCustomerTablet } from './SelectCustomerTablet';
import { AddProducts } from './AddProducts';
import { SaleSummary } from './SaleSummary';
import { PaymentDialog } from './PaymentDialog';
import type { PaymentResult } from './PaymentDialog';
import { SaleConfirmation } from './SaleConfirmation';
import { StudioDetailsStep, type StudioDetailsData } from './StudioDetailsStep';
import { TransactionSuccessModal, type TransactionSuccessData } from '../shared/TransactionSuccessModal';
import { getEffectivePrinterSettings } from '../../api/settings';
import { maybeAutoPrintAfterTransaction, manualPrintReceipt } from '../../services/printAfterTransaction';
import { useSingleFlightAction } from '../../hooks/useSingleFlightAction';
import { useSubmitLock } from '../../contexts/LoadingContext';
import { localNowDateString, formatLocalDateYYYYMMDD, getCurrentLocalTimestamp } from '../../utils/localDate';
import { useSettings } from '../../context/SettingsContext';
import { orderSaleLinesForPersist } from '../../lib/bespokeCartInjection';
import { useEffectiveWorkerId, useEffectiveWorkerRole, useEffectiveWorkerProfileId } from '../../context/CounterWorkerContext';

function localDatePlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return formatLocalDateYYYYMMDD(d);
}

export type SalesStep = 'home' | 'customer' | 'products' | 'studioDetails' | 'summary' | 'payment' | 'confirmation';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  balance: number;
}

export interface Product {
  id: string;
  /** Stable cart line id for bespoke parent/child linking (defaults from id+variation at save). */
  cartLineId?: string;
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
  customizationDetails?: Record<string, unknown> | null;
  bespokeParentCartId?: string | number;
  bespokeRole?: 'fabric';
  isBespokeInjected?: boolean;
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
  /** In-memory files chosen on Sale Summary; uploaded after sale is created. */
  attachmentFiles?: File[];
  /** Calendar date for invoice (YYYY-MM-DD, local). */
  saleDate: string;
  saleType: 'regular' | 'studio';
  /** Studio only: order date (YYYY-MM-DD), deadline (YYYY-MM-DD), required design name, optional production notes */
  orderDate?: string;
  deadlineDate?: string;
  studioProductName?: string;
  productionNotes?: string;
  /** Regular sale only: draft / quotation / order / final (studio always order). */
  documentStatus?: 'draft' | 'quotation' | 'order' | 'final';
}

interface SalesModuleProps {
  onBack: () => void;
  user: User;
  companyId: string | null;
  /** From App branch context only; do not compute inside Payment. */
  branchId: string | null;
  initialSaleType?: 'regular' | 'studio';
  /** Branch chosen upstream (e.g. Studio Add gate) before opening create flow. */
  initialDocumentBranchId?: string | null;
  onConsumedInitialDocumentBranchId?: () => void;
  /** If provided, completing a studio sale navigates to the Studio module with the new sale focused. */
  onOpenStudio?: (saleId: string) => void;
  initialEditSaleId?: string | null;
  onConsumedInitialEditSaleId?: () => void;
}

export function SalesModule({
  onBack,
  user,
  companyId,
  branchId,
  initialSaleType,
  initialDocumentBranchId,
  onConsumedInitialDocumentBranchId,
  onOpenStudio,
  initialEditSaleId,
  onConsumedInitialEditSaleId,
}: SalesModuleProps) {
  const responsive = useResponsive();
  const { reload: reloadSettings } = useSettings();
  const effectiveUserId = useEffectiveWorkerId(user.id);
  const effectiveRole = useEffectiveWorkerRole(user.role);
  const effectiveProfileId = useEffectiveWorkerProfileId() ?? user.profileId ?? null;

  useEffect(() => {
    if (companyId) void reloadSettings(companyId);
  }, [companyId, reloadSettings]);

  const [step, setStep] = useState<SalesStep>(
    initialSaleType === 'studio' && initialDocumentBranchId ? 'customer' : initialSaleType === 'studio' ? 'home' : 'home',
  );
  const [documentBranchId, setDocumentBranchId] = useState<string | null>(initialDocumentBranchId ?? null);
  const { run: runSave, busy: saving } = useSubmitLock();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [createdInvoiceNo, setCreatedInvoiceNo] = useState<string | null>(null);
  const [createdSaleId, setCreatedSaleId] = useState<string | null>(null);
  const [confirmationData, setConfirmationData] = useState<TransactionSuccessData | null>(null);
  const { runSingleFlight, isRunning: isPaymentSubmitRunning } = useSingleFlightAction();
  const [saleData, setSaleData] = useState<SaleData>({
    customer: null,
    products: [],
    subtotal: 0,
    discount: 0,
    shipping: 0,
    tax: 0,
    total: 0,
    notes: '',
    attachmentFiles: [],
    saleDate: localNowDateString(),
    saleType: initialSaleType === 'studio' ? 'studio' : 'regular',
    orderDate: localNowDateString(),
    deadlineDate: localDatePlusDays(7),
    studioProductName: '',
    productionNotes: '',
    documentStatus: 'order',
  });

  const { runWithBranch, modalProps: branchGateModalProps } = useDocumentBranchGate({
    companyId,
    globalBranchId: branchId,
    userRole: effectiveRole,
    authUserId: effectiveUserId,
    profileId: effectiveProfileId,
    invalidateDomains: ['contacts', 'sales', 'inventory'],
  });

  const {
    effectiveBranchId,
    needsPicker,
    pickerBranches,
    pickedBranchId,
    setPickedBranchId,
    ready: branchReady,
    error: branchSelectionError,
    accessibleBranches,
  } = useWriteBranchSelection({
    companyId,
    globalBranchId: branchId,
    documentBranchId,
    userRole: effectiveRole,
    authUserId: effectiveUserId,
    profileId: effectiveProfileId,
  });

  useEffect(() => {
    if (!initialDocumentBranchId) return;
    setDocumentBranchId(initialDocumentBranchId);
    setPickedBranchId(initialDocumentBranchId);
    if (initialSaleType === 'studio') setStep('customer');
    onConsumedInitialDocumentBranchId?.();
  }, [initialDocumentBranchId, initialSaleType, onConsumedInitialDocumentBranchId, setPickedBranchId]);

  const resetSaleData = useCallback((saleType: 'regular' | 'studio' = 'regular') => {
    setSaleData({
      customer: null,
      products: [],
      subtotal: 0,
      discount: 0,
      shipping: 0,
      tax: 0,
      total: 0,
      notes: '',
      attachmentFiles: [],
      saleDate: localNowDateString(),
      saleType,
      orderDate: localNowDateString(),
      deadlineDate: localDatePlusDays(7),
      studioProductName: '',
      productionNotes: '',
      documentStatus: saleType === 'studio' ? 'order' : 'order',
    });
  }, []);

  const startNewSaleFlow = useCallback(
    (options?: { saleType?: 'regular' | 'studio' }) => {
      const saleType = options?.saleType ?? 'regular';
      setDocumentBranchId(null);
      setPickedBranchId('');
      runWithBranch(
        (pickedId) => {
          setDocumentBranchId(pickedId);
          setPickedBranchId(pickedId);
          resetSaleData(saleType);
          setStep('customer');
        },
        {
          title: saleType === 'studio' ? 'Select branch for studio sale' : 'Select branch for sale',
        },
      );
    },
    [runWithBranch, resetSaleData, setPickedBranchId],
  );

  const handleStepBack = () => {
    if (step === 'customer') setStep('home');
    else if (step === 'products') setStep('customer');
    else if (step === 'studioDetails') setStep('products');
    else if (step === 'summary') setStep(saleData.saleType === 'studio' ? 'studioDetails' : 'products');
    else if (step === 'payment') setStep('summary');
    else if (step === 'confirmation') setStep('home');
    else onBack();
  };

  const handleNewSale = () => startNewSaleFlow();
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
    setSaleData((prev) => ({
      ...prev,
      ...data,
      saleDate: data.orderDate || prev.saleDate || localNowDateString(),
    }));
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
    if (!branchReady || !effectiveBranchId) {
      setSaveError(branchSelectionError ?? 'Select a branch for this sale.');
      return;
    }
    const status = saleData.saleType === 'studio' ? 'order' : (saleData.documentStatus ?? 'order');
    if (status !== 'final') {
      void handlePaymentComplete({
        paymentMethod: 'Credit',
        paidAmount: 0,
        dueAmount: saleData.total,
        paymentDate: saleData.saleDate || localNowDateString(),
        accountId: null,
      });
      return;
    }
    setStep('payment');
  };
  const handlePaymentComplete = async (result: PaymentResult) => {
    await runSingleFlight(async () => {
    if (!companyId || !user?.id) {
      setSaveError('Company or user missing.');
      return;
    }
    const paid = result.paidAmount ?? 0;
    if (paid > 0 && !result.accountId) {
      setSaveError('Please select a payment account for accounting.');
      return;
    }
    await runSave('Saving sale...', async () => {
    setSaveError(null);
    if (!effectiveBranchId) {
      setSaveError(branchSelectionError ?? 'Select a branch for this sale.');
      return;
    }
    if (saleData.saleType === 'studio' && !(saleData.studioProductName ?? '').trim()) {
      setSaveError('Studio product name is required.');
      return;
    }
    const cartLines = saleData.products.map((p, idx) => ({
      id: p.cartLineId ?? `${p.id}-${p.variationId ?? 'base'}-${idx}`,
      productId: p.id,
      variationId: p.variationId,
      productName: p.name,
      sku: p.sku ?? '—',
      quantity: p.quantity,
      unitPrice: p.price,
      total: p.total,
      customizationDetails: p.customizationDetails ?? null,
      bespokeParentCartId: p.bespokeParentCartId,
      parentLineIndex: undefined as number | undefined,
      packingDetails: p.packingDetails && (p.packingDetails.total_meters ?? 0) > 0
        ? { total_boxes: p.packingDetails.total_boxes, total_pieces: p.packingDetails.total_pieces }
        : undefined,
    }));
    const items = orderSaleLinesForPersist(cartLines).map((line) => ({
      productId: String(line.productId),
      variationId: line.variationId,
      productName: line.productName,
      sku: line.sku,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      total: line.total,
      customizationDetails: line.customizationDetails ?? undefined,
      parentLineIndex: line.parentLineIndex,
      packingDetails: line.packingDetails,
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
      userId: effectiveUserId,
      invoiceDate: saleData.saleDate || localNowDateString(),
      paymentDate: result.paymentDate || localNowDateString(),
      ...(saleData.saleType === 'studio' && {
        orderDate: saleData.orderDate || undefined,
        deadline: saleData.deadlineDate || undefined,
        studioDesignName: (saleData.studioProductName ?? '').trim() || undefined,
      }),
      ...(saleData.saleType === 'regular' && {
        targetStatus: saleData.documentStatus ?? 'order',
        documentType: saleData.documentStatus === 'quotation' ? 'quotation' as const : 'invoice' as const,
      }),
    };

    if (saleData.attachmentFiles && saleData.attachmentFiles.length > 0 && !navigator.onLine) {
      setSaveError('Attachments require an internet connection. Remove files or go online to save.');
      return;
    }

    if (!navigator.onLine) {
      try {
        await addPending('sale', salePayload, companyId, effectiveBranchId);
        setCreatedInvoiceNo('Pending sync');
        setStep('confirmation');
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : 'Failed to save offline.');
      }
      return;
    }

    const { data, error } = await salesApi.createSale(salePayload);
    if (error) {
      setSaveError(error);
      return;
    }
    if (data?.id && saleData.attachmentFiles && saleData.attachmentFiles.length > 0) {
      const upload = await salesApi.uploadSaleAttachments(companyId, data.id, saleData.attachmentFiles);
      if (upload.error) {
        setSaveError(`Sale saved but attachments failed: ${upload.error}`);
        return;
      }
      if (upload.data.length > 0) {
        const { error: attErr } = await salesApi.updateSaleAttachments(data.id, upload.data);
        if (attErr) {
          setSaveError(`Sale saved but attachments could not be linked: ${attErr}`);
          return;
        }
      }
    }
    setCreatedInvoiceNo(data?.invoiceNo ?? null);
    setCreatedSaleId(data?.id ?? null);
    let branchName: string | null = null;
    if (effectiveBranchId) {
      branchName = accessibleBranches.find((b) => b.id === effectiveBranchId)?.name ?? null;
    }
    setConfirmationData({
      type: 'sale',
      title: 'Sale Saved Successfully',
      transactionNo: data?.invoiceNo ?? null,
      amount: saleData.total,
      partyName: saleData.customer?.name ?? 'Walk-in',
      date: getCurrentLocalTimestamp(),
      branch: branchName ?? undefined,
      entityId: data?.id ?? null,
    });
    void maybeAutoPrintAfterTransaction(
      companyId,
      {
        title: 'SALE RECEIPT',
        transactionNo: data?.invoiceNo ?? null,
        partyName: saleData.customer?.name ?? 'Walk-in',
        amount: saleData.total,
        date: getCurrentLocalTimestamp(),
        branch: branchName ?? undefined,
      },
      { mirrorFromCompany: user.role === 'admin' || user.role === 'owner' }
    );
    });
  });
  };
  const handleNewSaleFromConfirmation = () => {
    setCreatedInvoiceNo(null);
    startNewSaleFlow();
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
      attachmentFiles: [],
      saleDate: localNowDateString(),
      saleType: 'regular',
      orderDate: localNowDateString(),
      deadlineDate: localDatePlusDays(7),
      studioProductName: '',
      productionNotes: '',
    });
    onBack();
  };

  const handlePrintReceipt = useCallback(async () => {
    const data = confirmationData;
    if (!companyId || !data) return;
    const res = await manualPrintReceipt(companyId, {
      title: 'SALE RECEIPT',
      transactionNo: data.transactionNo,
      partyName: data.partyName,
      amount: data.amount ?? null,
      date: data.date,
      branch: data.branch,
    });
    if (!res.ok && res.hint) window.alert(res.hint);
  }, [companyId, confirmationData]);

  const [printButtonLabel, setPrintButtonLabel] = useState('Print receipt');
  useEffect(() => {
    if (!companyId) return;
    getEffectivePrinterSettings(companyId).then(({ data }) => {
      setPrintButtonLabel(data.mode === 'thermal' ? 'Thermal print' : 'Print receipt (A4)');
    });
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
      attachmentFiles: [],
      saleDate: localNowDateString(),
      saleType: 'regular',
      orderDate: localNowDateString(),
      deadlineDate: localDatePlusDays(7),
      studioProductName: '',
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
    startNewSaleFlow();
  };

  return (
    <>
      {step === 'home' && (
        <SalesHome
          onBack={onBack}
          onNewSale={handleNewSale}
          companyId={companyId}
          branchId={branchId}
          userId={user?.id ?? null}
          userProfileId={user?.profileId ?? null}
          sessionRole={user?.role ?? null}
          initialEditSaleId={initialEditSaleId}
          onConsumedInitialEditSaleId={onConsumedInitialEditSaleId}
        />
      )}
      {step === 'customer' && (responsive.isTablet ? (
        <SelectCustomerTablet
          companyId={companyId}
          branchId={documentBranchId ?? effectiveBranchId}
          onBack={handleStepBack}
          onSelect={handleCustomerSelect}
          initialSaleType={saleData.saleType}
          onSaleTypeChange={(st) => setSaleData((prev) => ({ ...prev, saleType: st }))}
        />
      ) : (
        <SelectCustomer
          companyId={companyId}
          branchId={documentBranchId ?? effectiveBranchId}
          onBack={handleStepBack}
          onSelect={handleCustomerSelect}
          initialSaleType={saleData.saleType}
          onSaleTypeChange={(st) => setSaleData((prev) => ({ ...prev, saleType: st }))}
        />
      ))}
      {step === 'products' && saleData.customer && (
        <AddProducts
          companyId={companyId}
          branchId={documentBranchId ?? effectiveBranchId}
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
            orderDate: saleData.orderDate || localNowDateString(),
            deadlineDate: saleData.deadlineDate || localDatePlusDays(7),
            studioProductName: saleData.studioProductName || '',
            productionNotes: saleData.productionNotes || '',
          }}
          onNext={handleStudioDetailsNext}
        />
      )}
      {step === 'summary' && (
        <SaleSummary
          onBack={handleStepBack}
          saleData={saleData}
          onUpdate={handleSummaryUpdate}
          onProceedToPayment={handleProceedToPayment}
          needsBranchPicker={needsPicker}
          branchPickerBranches={pickerBranches}
          pickedBranchId={pickedBranchId}
          onPickedBranchChange={setPickedBranchId}
          branchSelectionError={branchSelectionError}
          branchReady={branchReady}
        />
      )}
      {step === 'payment' && (
        !branchReady || !effectiveBranchId
          ? (
            <div className="min-h-[50vh] flex flex-col items-center justify-center p-6">
              <p className="text-[#EF4444] text-center font-medium mb-4">
                {branchSelectionError ?? 'Select a branch for this sale.'}
              </p>
              <button type="button" onClick={handleStepBack} className="px-4 py-2 bg-[#3B82F6] text-white rounded-lg font-medium">Go back</button>
            </div>
            )
          : (
            <PaymentDialog
              onBack={handleStepBack}
              totalAmount={saleData.total}
              companyId={companyId}
              onComplete={handlePaymentComplete}
              saving={saving || isPaymentSubmitRunning}
              saveError={saveError}
              hasCustomer={!!saleData.customer?.id}
              viewerRole={effectiveRole}
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
        onThermalPrint={handlePrintReceipt}
        printReceiptLabel={printButtonLabel}
        onNewSale={handleSuccessNewSale}
        onHome={handleBackToHome}
      />

      <DocumentBranchGateModal
        {...branchGateModalProps}
        accentClass="text-[#2563EB] hover:border-[#2563EB]"
      />
    </>
  );
}
