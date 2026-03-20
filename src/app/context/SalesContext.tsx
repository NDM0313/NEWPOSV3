// ============================================
// 🎯 SALES CONTEXT
// ============================================
// Manages sales, quotations, and invoices with auto-numbering

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { useDocumentNumbering } from '@/app/hooks/useDocumentNumbering';
import { useAccounting } from '@/app/context/AccountingContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { saleService, Sale as SupabaseSale, SaleItem as SupabaseSaleItem } from '@/app/services/saleService';
import { productService } from '@/app/services/productService';
import { branchService } from '@/app/services/branchService';
import { comboService } from '@/app/services/comboService';
import { getOrCreateLedger, addLedgerEntry } from '@/app/services/ledgerService';
import { useSettings } from '@/app/context/SettingsContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { toast } from 'sonner';
import { activityLogService } from '@/app/services/activityLogService';
import { documentNumberService } from '@/app/services/documentNumberService';
import { shipmentService } from '@/app/services/shipmentService';
import {
  canPostAccountingForSaleStatus,
  canPostStockForSaleStatus,
} from '@/app/lib/postingStatusGate';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidBranchId(id: string | null): id is string {
  return !!id && UUID_REGEX.test(id);
}

// ============================================
// TYPES
// ============================================

export type PaymentStatus = 'paid' | 'partial' | 'unpaid';
export type ShippingStatus =
  | 'delivered'
  | 'processing'
  | 'pending'
  | 'cancelled'
  | 'Booked'
  | 'Picked'
  | 'In Transit'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Returned'
  | 'Cancelled'
  | 'Dispatched'
  | 'Created'
  | 'Packed'
  | 'Pending';
export type SaleType = 'invoice' | 'quotation';

export interface SaleItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  price: number;
  discount: number;
  tax: number;
  total: number;
  variationId?: string; // Backend variation id - for ledger/reporting/stock
  /** Unit from backend (sales_items.unit): piece, box, meters, etc. */
  unit?: string;
  /** Packing from backend (sales_items.packing_*) - for display/reports */
  packingDetails?: { packing_type?: string; packing_quantity?: number; packing_unit?: string; [k: string]: unknown };
  /** True for the auto-generated studio product line; false/undefined for material items (fabric, lace, etc.). */
  isStudioProduct?: boolean;
}

export interface Sale {
  id: string;
  invoiceNo: string;
  type: SaleType;
  status?: 'draft' | 'quotation' | 'order' | 'final' | 'cancelled'; // Sale lifecycle; cancelled = reversed
  customer: string;
  customerName: string;
  contactNumber: string;
  date: string;
  location: string;
  items: SaleItem[];
  itemsCount: number;
  subtotal: number;
  discount: number;
  tax: number;
  expenses: number;
  shippingCharges?: number; // For backward compatibility
  otherCharges?: number; // Extra charges beyond shipping
  total: number;
  /** Studio worker cost (from linked productions). Final bill = total + studioCharges. */
  studioCharges?: number;
  paid: number;
  due: number;
  returnDue: number;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  shippingStatus: ShippingStatus | string;
  /** True when sale has at least one record in sale_shipments. */
  hasShipment?: boolean;
  /** First shipment id (from sale_shipments) for this sale; used for ledger and history. */
  firstShipmentId?: string;
  notes?: string;
  /** Delivery/deadline date (YYYY-MM-DD) for studio sales. */
  deadline?: string;
  attachments?: { url: string; name: string }[] | null; // Sale attachments
  /** Line-level charges from sale_charges (for view/drawer actual data) */
  charges?: Array<{ charge_type?: string; chargeType?: string; amount: number }>;
  createdAt: string;
  updatedAt: string;
  is_studio?: boolean;
  /** User who created the sale (full name for display) */
  createdBy?: string;
  /** Origin e.g. studio_production_v3 */
  source?: string;
  /** ID of source record (e.g. studio_production_orders_v3.id) */
  source_id?: string;
  /** Show production breakdown on invoice (Studio V3) */
  show_studio_breakdown?: boolean;
  /** Salesperson (user id) for commission */
  salesmanId?: string | null;
  /** Commission amount stored on sale (for period reporting) */
  commissionAmount?: number;
  /** pending | posted — only batch posting sets posted */
  commissionStatus?: 'pending' | 'posted';
  /** Set when posted via Commission Report */
  commissionBatchId?: string | null;
  /** Commission rate at time of sale (audit) */
  commissionPercent?: number | null;
}

interface SalesContextType {
  sales: Sale[];
  loading: boolean;
  /** Total count for pagination (when using paginated load). */
  totalCount: number;
  /** Current 0-based page (pageSize rows per page). */
  page: number;
  pageSize: number;
  /** Set current page and reload (0-based). */
  setPage: (page: number) => void;
  getSaleById: (id: string) => Sale | undefined;
  createSale: (
    sale: Omit<Sale, 'id' | 'invoiceNo' | 'createdAt' | 'updatedAt'>,
    convOpts?: { conversionSourceId?: string }
  ) => Promise<Sale>;
  updateSale: (id: string, updates: Partial<Sale>) => Promise<void>;
  deleteSale: (id: string) => Promise<void>;
  recordPayment: (saleId: string, amount: number, method: string, accountId?: string) => Promise<void>;
  updateShippingStatus: (saleId: string, status: ShippingStatus) => Promise<void>;
  convertQuotationToInvoice: (quotationId: string) => Promise<Sale>;
  refreshSales: () => Promise<void>;
}

// ============================================
// CONTEXT
// ============================================

const SalesContext = createContext<SalesContextType | undefined>(undefined);

export const useSales = () => {
  const context = useContext(SalesContext);
  if (!context) {
    // During hot reload or initial mount, context might not be available; return safe default to prevent crashes
    if (import.meta.env.DEV) {
      const defaultError = () => { throw new Error('SalesProvider not available'); };
      return {
        sales: [],
        loading: false,
        totalCount: 0,
        page: 0,
        pageSize: 50,
        setPage: () => {},
        getSaleById: () => undefined,
        createSale: defaultError as SalesContextType['createSale'],
        updateSale: defaultError,
        deleteSale: defaultError,
        recordPayment: defaultError,
        updateShippingStatus: defaultError,
        convertQuotationToInvoice: defaultError,
        refreshSales: async () => {},
      } as SalesContextType;
    }
    throw new Error('useSales must be used within SalesProvider');
  }
  return context;
};

// ============================================
// MOCK DATA (Initial)
// ============================================

const INITIAL_SALES: Sale[] = [
  {
    id: 'sale-1',
    invoiceNo: 'INV-0001',
    type: 'invoice',
    customer: 'Ahmed Retailers',
    customerName: 'Ahmed Ali',
    contactNumber: '+92-300-1234567',
    date: '2024-01-15',
    location: 'Main Branch (HQ)',
    items: [],
    itemsCount: 12,
    subtotal: 45000,
    discount: 0,
    tax: 0,
    expenses: 500,
    total: 45500,
    paid: 45500,
    due: 0,
    returnDue: 0,
    paymentStatus: 'paid',
    paymentMethod: 'Cash',
    shippingStatus: 'delivered',
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-01-15T10:30:00Z',
  },
  {
    id: 'sale-2',
    invoiceNo: 'INV-0002',
    type: 'invoice',
    customer: 'Walk-in Customer',
    customerName: 'Sara Khan',
    contactNumber: '+92-321-9876543',
    date: '2024-01-15',
    location: 'Mall Outlet',
    items: [],
    itemsCount: 3,
    subtotal: 8000,
    discount: 0,
    tax: 0,
    expenses: 200,
    total: 8200,
    paid: 5000,
    due: 3200,
    returnDue: 0,
    paymentStatus: 'partial',
    paymentMethod: 'Card',
    shippingStatus: 'pending',
    createdAt: '2024-01-15T11:00:00Z',
    updatedAt: '2024-01-15T11:00:00Z',
  },
  {
    id: 'sale-3',
    invoiceNo: 'QUO-0001',
    type: 'quotation',
    customer: 'Local Store',
    customerName: 'Bilal Ahmed',
    contactNumber: '+92-333-5555555',
    date: '2024-01-14',
    location: 'Main Branch (HQ)',
    items: [],
    itemsCount: 24,
    subtotal: 98000,
    discount: 0,
    tax: 0,
    expenses: 1200,
    total: 99200,
    paid: 0,
    due: 99200,
    returnDue: 0,
    paymentStatus: 'unpaid',
    paymentMethod: 'Credit',
    shippingStatus: 'pending',
    createdAt: '2024-01-14T14:20:00Z',
    updatedAt: '2024-01-14T14:20:00Z',
  },
];

// ============================================
// PROVIDER
// ============================================

// Helper function to normalize payment method to enum values
// Returns lowercase enum values: 'cash', 'bank', 'card', 'other'
const normalizePaymentMethodForEnum = (method: string | undefined): string => {
  if (!method) return 'cash';
  const normalized = method.toLowerCase().trim();
  const enumMap: Record<string, string> = {
    'cash': 'cash',
    'Cash': 'cash',
    'mobile wallet': 'card', // Mobile Wallet maps to 'card' enum in database
    'Mobile Wallet': 'card',
    'other': 'card', // Legacy 'other' maps to 'card' for backward compatibility
    'Other': 'card',
    'bank': 'bank',
    'Bank': 'bank',
    'card': 'card',
    'Card': 'card',
    'cheque': 'other',
    'Cheque': 'other',
    'wallet': 'other',
    'Wallet': 'other',
  };
  return enumMap[method] || enumMap[normalized] || 'cash';
};

// CRITICAL FIX: Export convertFromSupabaseSale as a standalone function
// This allows it to be used outside the context provider
export const convertFromSupabaseSale = (supabaseSale: any): Sale => {
  // Resolve branch display: use joined branch data if available
  // UI Rule: Show only branch NAME (not code, never UUID)
  let locationDisplay = '';
  if (supabaseSale.branch) {
    // Branch data joined from API - show NAME only
    locationDisplay = supabaseSale.branch.name || '';
  }
  // Note: Do NOT fallback to branch_id UUID - it should never appear in UI
  
    return {
      id: supabaseSale.id,
      invoiceNo: supabaseSale.invoice_no || '',
      type: supabaseSale.status === 'quotation' ? 'quotation' : 'invoice',
    status: supabaseSale.status || (supabaseSale.type === 'invoice' ? 'final' : 'quotation'),
      customer: supabaseSale.customer_id || '',
      customerName: supabaseSale.customer_name || '',
      contactNumber: supabaseSale.customer?.phone || '',
      date: supabaseSale.invoice_date || new Date().toISOString().split('T')[0],
    location: locationDisplay,
    items: (supabaseSale.items || []).map((item: any) => {
      // Packing: single source of truth from backend (same as Purchase – parse if JSON string from API)
      const rawPd = item.packing_details;
      const pd = rawPd != null && typeof rawPd === 'string'
        ? (() => { try { return JSON.parse(rawPd); } catch { return null; } })()
        : rawPd;
      const packingDetails = pd && typeof pd === 'object'
        ? { ...pd, total_boxes: pd.total_boxes ?? 0, total_pieces: pd.total_pieces ?? 0, total_meters: pd.total_meters ?? item.packing_quantity ?? 0, boxes: pd.boxes || [] }
        : (item.packing_quantity != null && item.packing_quantity !== '')
          ? { total_boxes: 0, total_pieces: 0, total_meters: Number(item.packing_quantity) || 0, boxes: [] as any[] }
          : undefined;
      return {
        id: item.id || '',
        productId: item.product_id || '',
        productName: item.product_name || '',
        sku: item.sku || item.product?.sku || 'N/A',
        quantity: item.quantity || 0,
        price: item.unit_price || 0,
        discount: item.discount_amount || 0,
        tax: item.tax_amount || 0,
        total: item.total || 0,
        variationId: item.variation_id || undefined,
        unit: item.unit || undefined,
        size: item.variation?.size || item.size || undefined,
        color: item.variation?.color || item.color || undefined,
        packingDetails: packingDetails ?? undefined,
        thaans: packingDetails?.total_boxes ?? item.packing_details?.thaans,
        meters: packingDetails?.total_meters ?? item.packing_quantity ?? undefined,
        isStudioProduct: item.is_studio_product === true,
      };
    }),
      itemsCount: supabaseSale.items?.length || 0,
      subtotal: supabaseSale.subtotal || 0,
      discount: supabaseSale.discount_amount || 0,
      tax: supabaseSale.tax_amount || 0,
    expenses: supabaseSale.expenses || supabaseSale.shipment_charges || supabaseSale.shipping_charges || 0,
    shippingCharges: supabaseSale.shipment_charges ?? supabaseSale.expenses ?? supabaseSale.shipping_charges ?? 0, // Issue 02: prefer trigger-synced shipment_charges
    otherCharges: supabaseSale.other_charges || 0, // Extra charges if any
      total: supabaseSale.total || 0,
      studioCharges: supabaseSale.studio_charges != null ? Number(supabaseSale.studio_charges) : undefined,
      paid: supabaseSale.paid_amount || 0,
      due: supabaseSale.due_amount || 0,
    returnDue: supabaseSale.return_due || 0,
      paymentStatus: supabaseSale.payment_status || 'unpaid',
    paymentMethod: supabaseSale.payment_method || 'Cash',
    shippingStatus: (supabaseSale.shipment_status || supabaseSale.shipping_status || 'pending') as ShippingStatus | string,
      hasShipment: !!supabaseSale.first_shipment_id,
      firstShipmentId: supabaseSale.first_shipment_id || undefined,
      notes: supabaseSale.notes,
      deadline: supabaseSale.deadline || undefined,
      // CRITICAL FIX: Preserve attachments from database
      attachments: supabaseSale.attachments || null,
      // Line-level charges (sale_charges) for drawer/views to show actual data
      charges: Array.isArray(supabaseSale.charges) ? supabaseSale.charges : (Array.isArray(supabaseSale.sale_charges) ? supabaseSale.sale_charges : []),
      createdAt: supabaseSale.created_at || new Date().toISOString(),
      updatedAt: supabaseSale.updated_at || new Date().toISOString(),
    is_studio: !!supabaseSale.is_studio,
    createdBy: (supabaseSale.created_by?.full_name ?? supabaseSale.created_by_user?.full_name) || undefined,
    source: (supabaseSale as any).source ?? undefined,
    source_id: (supabaseSale as any).source_id ?? undefined,
    show_studio_breakdown: !!(supabaseSale as any).show_studio_breakdown,
    salesmanId: supabaseSale.salesman_id ?? undefined,
    commissionAmount: supabaseSale.commission_amount != null ? Number(supabaseSale.commission_amount) : undefined,
    commissionStatus: (supabaseSale as any).commission_status ?? undefined,
    commissionBatchId: (supabaseSale as any).commission_batch_id ?? undefined,
    commissionPercent: (supabaseSale as any).commission_percent != null ? Number((supabaseSale as any).commission_percent) : undefined,
  };
};

const DEFAULT_PAGE_SIZE = 50;

export const SalesProvider = ({ children }: { children: ReactNode }) => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPageState] = useState(0);
  const [pageSize] = useState(DEFAULT_PAGE_SIZE);
  const { generateDocumentNumber, incrementNextNumber, getNumberingConfig } = useDocumentNumbering();
  const accounting = useAccounting();
  const { companyId, branchId, user } = useSupabase();
  const { modules, inventorySettings } = useSettings();
  const { formatCurrency } = useFormatCurrency();

  // Load sales from database (all up to cap for client-side filter/sort/pagination)
  const SALES_LOAD_CAP = 5000;
  const loadSales = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      const result = await saleService.getAllSales(
        companyId,
        branchId === 'all' ? undefined : branchId || undefined,
        { offset: 0, limit: SALES_LOAD_CAP }
      );
      const isPaginated = result && typeof result === 'object' && 'data' in result && 'total' in result;
      const data = isPaginated ? (result as { data: any[]; total: number }).data : (result as any[]);
      const total = isPaginated ? (result as { data: any[]; total: number }).total : data.length;
      setSales(data.map(convertFromSupabaseSale));
      setTotalCount(total);
    } catch (error) {
      console.error('[SALES CONTEXT] Error loading sales:', error);
      toast.error('Failed to load sales');
      setSales([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId]);

  const setPage = useCallback((p: number) => {
    setPageState(Math.max(0, p));
  }, []);

  useEffect(() => {
    if (companyId) loadSales();
    else setLoading(false);
  }, [companyId, loadSales]);

  // When page changes we do not refetch; SalesPage slices the loaded sales for display

  // Get sale by ID
  const getSaleById = (id: string): Sale | undefined => {
    return sales.find(s => s.id === id);
  };

  // Create new sale
  const createSale = async (
    saleData: Omit<Sale, 'id' | 'invoiceNo' | 'createdAt' | 'updatedAt'>,
    convOpts?: { conversionSourceId?: string }
  ): Promise<Sale> => {
    if (!companyId || !user) {
      throw new Error('Company ID and User are required');
    }
    // DB requires branch_id UUID; when Admin has "All Branches", branchId is 'all' – resolve to first branch
    let effectiveBranchId = isValidBranchId(branchId) ? branchId : null;
    if (!effectiveBranchId) {
      const branches = await branchService.getAllBranches(companyId);
      if (!branches?.length) throw new Error('No branch found. Please create at least one branch.');
      effectiveBranchId = branches[0].id;
    }

    try {
      if (convOpts?.conversionSourceId && (saleData as any).isStudioSale) {
        throw new Error('Studio orders cannot use this conversion. Use Generate Invoice from Studio.');
      }
      // CRITICAL FIX: Generate document number based on sale source + status (central numbering only)
      // Regular sale (final) → invoice → SL-0001. Studio → studio → STD-0001. POS → POS-. Draft/Quotation/Order → respective prefix.
      // SL and STD have separate counters; never mix.
      // Canonical conversion: always allocate a NEW final SL- number; source draft/QT/SO stays archived (never posted).
      const isPOS = (saleData as any).isPOS === true;
      const isStudioSale = (saleData as any).isStudioSale === true;
      // Studio orders must have at least one product (fabric/material); block creation of empty studio sales
      if (isStudioSale && (!saleData.items || saleData.items.length === 0)) {
        throw new Error('Studio order must have at least one product (fabric/material). Add an item in the sale before saving.');
      }
      let docType: 'draft' | 'quotation' | 'order' | 'invoice' | 'pos' | 'studio' = 'invoice';
      if (convOpts?.conversionSourceId) {
        docType = 'invoice';
      } else if (isPOS) {
        docType = 'pos';
      } else if (isStudioSale) {
        docType = 'studio';
      } else if (saleData.status === 'draft') {
        docType = 'draft';
      } else if (saleData.status === 'quotation') {
        docType = 'quotation';
      } else if (saleData.status === 'order') {
        docType = 'order';
      } else if (saleData.type === 'invoice' || saleData.status === 'final') {
        docType = 'invoice';
      }
      // Global document number from DB: separate sequence per type (DRAFT, QT, SO, SL, PS for POS)
      const sequenceType = docType === 'draft' ? 'DRAFT' : docType === 'quotation' ? 'QT' : docType === 'order' ? 'SO' : docType === 'studio' ? 'STD' : docType === 'pos' ? 'PS' : 'SL';
      let invoiceNo: string;
      try {
        invoiceNo = await documentNumberService.getNextDocumentNumberGlobal(companyId, sequenceType);
      } catch (e) {
        // Fallback to form number only if RPC missing (e.g. migration not run)
        const formInvoiceNo = (saleData as any).invoiceNo as string | undefined;
        invoiceNo = (typeof formInvoiceNo === 'string' && formInvoiceNo && !formInvoiceNo.includes('undefined'))
          ? formInvoiceNo
          : generateDocumentNumber(docType);
      }
      const weGeneratedNumber = true;
      if (!invoiceNo || invoiceNo.includes('undefined') || invoiceNo.includes('NaN')) {
        throw new Error(`Invalid invoice number generated: ${invoiceNo}. Check document numbering settings.`);
      }

      // Negative stock: only enforce when this save will post stock (`final`), not for draft/quotation/order
      const effectiveCreateStatus = saleData.status || (saleData.type === 'invoice' ? 'final' : 'quotation');
      const fromContext = inventorySettings.negativeStockAllowed === true;
      const fromDb = await import('@/app/services/settingsService').then(m => m.settingsService.getAllowNegativeStock(companyId));
      const allowNegative = fromContext || fromDb;
      if (import.meta.env?.DEV) {
        console.log('[SALES CONTEXT] Negative stock:', { allowNegative, fromContext, fromDb, inventorySettingsNegative: inventorySettings.negativeStockAllowed });
      }
      if (canPostStockForSaleStatus(effectiveCreateStatus) && !allowNegative && saleData.items?.length > 0) {
        const { supabase } = await import('@/lib/supabase');
        const productIds = [...new Set(saleData.items.map((i) => i.productId))];
        const [stockMap, { data: prods }] = await Promise.all([
          productService.getStockForProducts(productIds, companyId, effectiveBranchId ?? undefined),
          supabase.from('products').select('id, has_variations').in('id', productIds),
        ]);
        const productMap = new Map((prods || []).map((p: any) => [p.id, p]));

        for (const item of saleData.items) {
          const p = productMap.get(item.productId) as { has_variations?: boolean } | undefined;
          if (!p) continue;
          const key = (item as any).variationId ? `${item.productId}:${(item as any).variationId}` : `${item.productId}:`;
          const stock = stockMap.get(key) ?? 0;
          if (stock < item.quantity) {
            throw new Error(
              `${item.productName}: quantity (${item.quantity}) exceeds available stock (${stock}). ` +
              'To allow this sale, enable "Negative Stock Allowed" in Settings → Inventory.'
            );
          }
        }
      }

      // Identity: created_by must be auth.uid() (never public.users.id)
      const { data: { user: authUser } } = await import('@/lib/supabase').then(m => m.supabase.auth.getUser());
      const createdByAuthId = authUser?.id ?? user?.auth_user_id ?? user?.id;

      // Convert to Supabase format (use effectiveBranchId – valid UUID for DB)
      const salesmanIdVal = (saleData as any).salesmanId && (saleData as any).salesmanId !== 'none' && (saleData as any).salesmanId !== '1' ? (saleData as any).salesmanId : null;
      const commissionAmountVal = Number((saleData as any).commissionAmount) || 0;
      const supabaseSale: SupabaseSale = {
        company_id: companyId,
        branch_id: effectiveBranchId,
        invoice_no: invoiceNo,
        invoice_date: saleData.date,
        customer_id: saleData.customer || undefined,
        customer_name: saleData.customerName,
        type: convOpts?.conversionSourceId ? 'invoice' : saleData.type === 'invoice' ? 'invoice' : 'quotation',
        status: convOpts?.conversionSourceId
          ? 'final'
          : saleData.status || (saleData.type === 'invoice' ? 'final' : 'quotation'), // Conversion = always new posted final row
        payment_status: saleData.paymentStatus,
        payment_method: saleData.paymentMethod ? normalizePaymentMethodForEnum(saleData.paymentMethod) : undefined,
        subtotal: saleData.subtotal,
        discount_amount: saleData.discount || 0,
        tax_amount: saleData.tax || 0,
        expenses: saleData.expenses || 0, // Database has 'expenses' not 'shipping_charges'
        total: saleData.total,
        paid_amount: saleData.paid || 0,
        due_amount: saleData.due || 0,
        return_due: saleData.returnDue || 0,
        notes: saleData.notes,
        deadline: (saleData as any).deadline ?? null,
        created_by: createdByAuthId,
        salesman_id: salesmanIdVal,
        commission_amount: commissionAmountVal,
        commission_eligible_amount: saleData.subtotal ?? null,
        commission_status: 'pending',
        commission_batch_id: null,
        commission_percent: (saleData as any).commissionPercent != null ? Number((saleData as any).commissionPercent) : null,
        // Do not send is_studio in insert – column may not exist yet; set via update after create
      };

      const supabaseItems: SupabaseSaleItem[] = saleData.items.map(item => {
        const unitPrice = Number((item as any).unitPrice ?? item.price ?? 0);
        const lineTotal = Number((item as any).total ?? (unitPrice * item.quantity) ?? 0);
        return {
        product_id: item.productId,
        variation_id: item.variationId || undefined,
        product_name: item.productName,
        sku: (item as any).sku || 'N/A', // Required in DB
        quantity: item.quantity,
        unit: (item as any).unit && String((item as any).unit).trim() ? (item as any).unit : ((item as any).packingDetails?.unit || 'pcs'),
        unit_price: unitPrice, // POS sends unitPrice; SaleForm sends price – ensure never null for DB NOT NULL
        discount_amount: (item as any).discount || 0,
        tax_amount: (item as any).tax || 0,
        total: lineTotal,
        // Include packing data
        packing_type: (item as any).packingDetails?.packing_type || null,
        packing_quantity: (item as any).packingDetails?.total_meters || (item as any).meters || null,
        packing_unit: (item as any).packingDetails?.unit || 'meters',
        packing_details: (item as any).packingDetails || null,
      };
      });

      const allowNegativeStock = allowNegative; // DB value passed to service so it does not re-read
      let result: any;
      let effectiveInvoiceNo = invoiceNo;
      try {
        result = await saleService.createSale(supabaseSale, supabaseItems, {
          allowNegativeStock,
          conversionSourceId: convOpts?.conversionSourceId,
        });
        const deadlineErr = (result as any)?.deadlineError;
        if (deadlineErr) {
          toast.warning(`Deadline could not be saved: ${deadlineErr}. Run migrations/sales_set_deadline_rpc.sql in Supabase, then try again.`);
        } else if ((saleData as any).deadline && result && (result.deadline == null || result.deadline === '')) {
          toast.warning(
            'Notes saved. Deadline did not persist. Run "migrations/sales_set_deadline_rpc.sql" in Supabase SQL Editor, then save again.'
          );
        }
      } catch (insertError: any) {
        const msg = insertError?.message || '';
        const isDuplicateInvoice = insertError?.code === '23505' || (msg && String(msg).includes('sales_company_branch_invoice_unique'));
        if (isDuplicateInvoice) {
          // Retry with fresh number from DB (single source of truth; avoids race with hook state)
          try {
            effectiveInvoiceNo = await documentNumberService.getNextDocumentNumberGlobal(companyId, sequenceType);
            supabaseSale.invoice_no = effectiveInvoiceNo;
            result = await saleService.createSale(supabaseSale, supabaseItems, {
              allowNegativeStock,
              conversionSourceId: convOpts?.conversionSourceId,
            });
            console.warn('[SALES CONTEXT] Duplicate invoice number; retried with DB number', effectiveInvoiceNo);
          } catch (retryErr: any) {
            throw retryErr;
          }
        } else {
          throw insertError;
        }
      }
      // Line-level charges: extraExpenses + standalone shipping + discount (all persisted to sale_charges)
      const createExtraExpenses = (saleData as any).extraExpenses;
      const createShippingCharges = Number((saleData as any).shippingCharges ?? 0);
      if (result?.id) {
        const charges: { charge_type: string; amount: number }[] = [];
        if (Array.isArray(createExtraExpenses)) {
          createExtraExpenses.forEach((e: { type?: string; amount?: number }) => {
            const amt = Number(e?.amount ?? 0);
            if (amt > 0) charges.push({ charge_type: (e?.type ?? 'other') as string, amount: amt });
          });
        }
        if (createShippingCharges > 0) charges.push({ charge_type: 'shipping', amount: createShippingCharges });
        const discountAmt = Number(saleData.discount ?? 0);
        if (discountAmt > 0) charges.push({ charge_type: 'discount', amount: discountAmt });
        if (charges.length > 0) {
          await saleService.replaceSaleCharges(result.id, charges, createdByAuthId);
        }
      }
      // Set is_studio after create (avoids 400 if sales.is_studio column not yet added by migration).
      // Do NOT auto-create production, product, or invoice line here. Invoice is created only when user
      // clicks "Generate Invoice" (Create Product + Generate Invoice) in Studio Production.
      if (isStudioSale && result?.id) {
        try {
          const { supabase: sb } = await import('@/lib/supabase');
          await sb.from('sales').update({ is_studio: true }).eq('id', result.id);
        } catch (_) { /* column may not exist */ }
      }
      // Document number comes from DB (get_next_document_number_global); do not increment frontend counter
      
      // Convert back to app format
      const newSale = convertFromSupabaseSale(result);
      
      // Activity timeline: log sale creation (non-blocking)
      if (companyId && user?.id) {
        activityLogService.logActivity({
          companyId,
          module: 'sale',
          entityId: newSale.id,
          entityReference: newSale.invoiceNo,
          action: 'create',
          performedBy: user.id,
          description: `Sale ${newSale.invoiceNo} created`,
        }).catch((err) => console.warn('[SALES] Activity log create failed:', err));
      }
      
      // CRITICAL FIX: Record MULTIPLE payments if partialPayments array exists
      // Each payment method = separate payment record = separate reference number = separate journal entry
      const partialPayments = (saleData as any).partialPayments || [];
      
      // Payments table + payment JEs: only for posted (final) sales — draft paid fields are UI/draft only
      if (
        newSale.paid > 0 &&
        companyId &&
        effectiveBranchId &&
        user &&
        canPostAccountingForSaleStatus(newSale.status)
      ) {
        try {
          const { accountHelperService } = await import('@/app/services/accountHelperService');
          const { saleService } = await import('@/app/services/saleService');
          const { accountService } = await import('@/app/services/accountService');
          
          // CRITICAL FIX: If partialPayments array exists, split into separate payments
          if (partialPayments.length > 0) {
            // Split payments: each method gets its own payment record
            for (const partialPayment of partialPayments) {
              const paymentMethod = normalizePaymentMethodForEnum(partialPayment.method || 'cash');
              
              // Get account for this payment method
              let paymentAccountId = await accountHelperService.getDefaultAccountByPaymentMethod(
                paymentMethod,
                companyId
              );
              
              // If no account found, use Cash as default
              if (!paymentAccountId) {
                const allAccounts = await accountService.getAllAccounts(companyId);
                const cashAccount = allAccounts.find(acc => acc.code === '1000');
                paymentAccountId = cashAccount?.id || null;
              }
              
              if (paymentAccountId && partialPayment.amount > 0) {
                // Let DB trigger set reference_number (avoid duplicate key)
                await saleService.recordPayment(
                  newSale.id,
                  partialPayment.amount,
                  paymentMethod,
                  paymentAccountId,
                  companyId,
                  effectiveBranchId,
                  saleData.date,
                  undefined
                );
                // Create separate journal entry for this payment
                accounting.recordSalePayment({
                  saleId: newSale.id,
                  invoiceNo: newSale.invoiceNo,
                  customerName: newSale.customerName,
                  amount: partialPayment.amount,
                  paymentMethod: paymentMethod as any,
                  accountId: paymentAccountId,
                });
              }
            }
          } else {
            // Fallback: Single payment (backward compatibility)
            const paymentMethod = normalizePaymentMethodForEnum(saleData.paymentMethod || 'cash');
            let paymentAccountId: string | null = null;
            
            // Check if payment already exists (from SQL trigger)
            const { supabase } = await import('@/lib/supabase');
            const { data: existingPayment } = await supabase
              .from('payments')
              .select('id, payment_account_id')
              .eq('reference_type', 'sale')
              .eq('reference_id', newSale.id)
              .eq('amount', newSale.paid)
              .limit(1)
              .maybeSingle();
            
            if (existingPayment) {
              // Payment already exists from trigger, use its account_id
              paymentAccountId = existingPayment.payment_account_id;
            } else {
              // Payment doesn't exist, create it
              paymentAccountId = await accountHelperService.getDefaultAccountByPaymentMethod(
                paymentMethod,
                companyId
              );
              
              // If no account found, use Cash as default
              if (!paymentAccountId) {
                const allAccounts = await accountService.getAllAccounts(companyId);
                const cashAccount = allAccounts.find(acc => acc.code === '1000');
                paymentAccountId = cashAccount?.id || null;
              }
              
              if (paymentAccountId) {
                await saleService.recordPayment(
                  newSale.id,
                  newSale.paid,
                  paymentMethod,
                  paymentAccountId,
                  companyId,
                  effectiveBranchId,
                  saleData.date,
                  undefined
                );
              }
            }
            
            // Create journal entry for initial payment (whether payment existed or was just created)
            if (paymentAccountId) {
              accounting.recordSalePayment({
                saleId: newSale.id,
                invoiceNo: newSale.invoiceNo,
                customerName: newSale.customerName,
                amount: newSale.paid,
                paymentMethod: paymentMethod as any,
                accountId: paymentAccountId,
              });
            }
          }
        } catch (error: any) {
          console.error('[SALES CONTEXT] Error recording initial payment:', error);
          // Don't fail sale creation if payment recording fails
        }
      }
      
      // Update local state (conversion: drop archived source row from list)
      setSales((prev) => {
        const rest = convOpts?.conversionSourceId
          ? prev.filter((s) => s.id !== convOpts.conversionSourceId)
          : prev;
        return [newSale, ...rest];
      });
      
      // Stock OUT only when status is posted (`final`). Never use type=invoice alone (draft invoice must not move stock).
      // If DB trigger already inserted movements (INSERT final), skip app loop to avoid duplicates.
      // STEP 1 RULE: Silent fail NOT allowed - throw error if stock movement fails
      if (canPostStockForSaleStatus(newSale.status) && newSale.items && newSale.items.length > 0) {
        const { supabase: sbStock } = await import('@/lib/supabase');
        const { count: existingSaleMov } = await sbStock
          .from('stock_movements')
          .select('*', { count: 'exact', head: true })
          .eq('reference_type', 'sale')
          .eq('reference_id', newSale.id);
        if ((existingSaleMov ?? 0) > 0) {
          console.log('[SALES CONTEXT] Stock already posted for sale (DB trigger); skipping duplicate app stock loop.');
          window.dispatchEvent(new CustomEvent('saleSaved', { detail: { saleId: newSale.id } }));
        } else {
        console.log('[SALES CONTEXT] 🔄 Creating stock movements for sale:', newSale.id, 'Items:', newSale.items.length);
        
        const stockMovementErrors: string[] = [];
        
        for (const item of newSale.items) {
          if (item.productId && item.quantity > 0) {
            try {
              // ============================================
              // COMBO HANDLING: Virtual Bundle Model
              // ============================================
              // If product is a combo, create stock movements for combo items
              // NOT for the combo product itself (combo product has no stock)
              // ============================================
              
              if (modules.combosEnabled) {
                const isCombo = await comboService.isComboProduct(item.productId, companyId);
                
                if (isCombo) {
                  console.log('[SALES CONTEXT] 🔄 Product is a combo, processing combo items:', {
                    combo_product_id: item.productId,
                    combo_quantity: item.quantity,
                    sale_id: newSale.id
                  });
                  
                  // Get combo details
                  const combo = await comboService.getComboByProductId(item.productId, companyId);
                  
                  if (!combo || !combo.items || combo.items.length === 0) {
                    throw new Error(`Combo product ${item.productId} has no items defined`);
                  }
                  
                  // Create stock movements for each combo item
                  for (const comboItem of combo.items) {
                    // Calculate quantity: combo_item.qty * sale_item.quantity
                    const componentQty = comboItem.qty * item.quantity;
                    
                    console.log('[SALES CONTEXT] Creating stock movement for combo item:', {
                      component_product_id: comboItem.product_id,
                      component_variation_id: comboItem.variation_id,
                      component_qty: componentQty,
                      combo_item_qty: comboItem.qty,
                      sale_item_qty: item.quantity
                    });
                    
                    // Create stock movement for component product (negative for stock OUT)
                    const movement = await productService.createStockMovement({
                      company_id: companyId,
                      branch_id: effectiveBranchId === 'all' ? undefined : effectiveBranchId,
                      product_id: comboItem.product_id,
                      variation_id: comboItem.variation_id || undefined,
                      movement_type: 'sale',
                      quantity: -componentQty, // Negative for stock OUT
                      unit_cost: comboItem.unit_price || 0,
                      total_cost: -(componentQty * (comboItem.unit_price || 0)),
                      reference_type: 'sale',
                      reference_id: newSale.id,
                      notes: `Combo sale ${newSale.invoiceNo}: ${combo.combo_name} - Component: ${comboItem.product_id}${comboItem.variation_id ? ' (Variation)' : ''}`,
                      created_by: createdByAuthId,
                    });
                    
                    if (!movement || !movement.id) {
                      throw new Error(`Stock movement creation returned null for combo component ${comboItem.product_id}`);
                    }
                    
                    console.log('[SALES CONTEXT] ✅ Stock movement created for combo component:', {
                      movement_id: movement.id,
                      product_id: comboItem.product_id,
                      variation_id: comboItem.variation_id,
                      quantity: movement.quantity
                    });
                    
                    // Stock is source-of-truth via stock_movements only. Do not update products.current_stock (column may not exist).
                  }
                  
                  // Skip creating stock movement for combo product itself (virtual bundle - no stock)
                  console.log('[SALES CONTEXT] ✅ Combo sale processed - stock movements created for all components');
                  continue;
                }
              }
              
              // ============================================
              // REGULAR PRODUCT HANDLING
              // ============================================
              console.log('[SALES CONTEXT] Creating stock movement for regular item:', {
                product_id: item.productId,
                variation_id: item.variationId,
                quantity: item.quantity,
                sale_id: newSale.id
              });
              
              const packing = (item as any).packingDetails;
              const boxOut = packing?.total_boxes != null ? Math.round(Number(packing.total_boxes)) : 0;
              const pieceOut = packing?.total_pieces != null ? Math.round(Number(packing.total_pieces)) : 0;
              const movement = await productService.createStockMovement({
                company_id: companyId,
                branch_id: effectiveBranchId === 'all' ? undefined : effectiveBranchId,
                product_id: item.productId,
                variation_id: item.variationId || undefined,
                movement_type: 'sale',
                quantity: -item.quantity,
                unit_cost: item.price || 0,
                total_cost: -((item.price || 0) * item.quantity),
                reference_type: 'sale',
                reference_id: newSale.id,
                notes: `Sale ${newSale.invoiceNo} - ${item.productName}${item.variationId ? ' (Variation)' : ''}`,
                created_by: createdByAuthId,
                box_change: -boxOut,
                piece_change: -pieceOut,
              });
              
              if (!movement || !movement.id) {
                throw new Error(`Stock movement creation returned null/undefined for product ${item.productId}`);
              }
              
              console.log('[SALES CONTEXT] ✅ Stock movement created:', {
                movement_id: movement.id,
                product_id: item.productId,
                variation_id: item.variationId,
                quantity: movement.quantity
              });
              
              // Stock is source-of-truth via stock_movements only. Do not update products.current_stock (column may not exist).
            } catch (movementError: any) {
              const errorMsg = `Failed to create stock movement for product ${item.productId} (${item.productName}): ${movementError.message || movementError}`;
              console.error('[SALES CONTEXT] ❌ Stock movement creation failed:', errorMsg);
              console.error('[SALES CONTEXT] Error details:', movementError);
              stockMovementErrors.push(errorMsg);
            }
          }
        }
        
        // CRITICAL: If any stock movement failed, throw error (no silent failures)
        if (stockMovementErrors.length > 0) {
          const errorMessage = `Stock movement creation failed for ${stockMovementErrors.length} item(s):\n${stockMovementErrors.join('\n')}`;
          console.error('[SALES CONTEXT] ❌ CRITICAL: Stock movements not created:', errorMessage);
          throw new Error(errorMessage);
        }
        
        console.log('[SALES CONTEXT] ✅ All stock movements created successfully for sale:', newSale.id);
        }
      }
      
      // Commission: NOT posted per sale (commission_status=pending until batch post).

      // 🔧 SALE DOCUMENT JE (single engine — saleAccountingService only; re-checks status=final in DB)
      if (canPostAccountingForSaleStatus(newSale.status) && companyId && newSale.total > 0) {
        const { saleAccountingService: sac } = await import('@/app/services/saleAccountingService');
        const shipmentCharges = Number((saleData as any).shippingCharges ?? 0) || 0;
        const jeId = await sac.createSaleJournalEntry({
          saleId: newSale.id,
          companyId,
          branchId: effectiveBranchId ?? undefined,
          total: newSale.total,
          discountAmount: Number(saleData.discount ?? 0) || undefined,
          shipmentCharges: shipmentCharges || undefined,
          invoiceNo: newSale.invoiceNo,
          performedBy: createdByAuthId ?? null,
        });
        if (!jeId) {
          const { findActiveCanonicalSaleDocumentJournalEntryId } = await import('@/app/services/saleAccountingService');
          const existingDoc = await findActiveCanonicalSaleDocumentJournalEntryId(newSale.id);
          if (!existingDoc) {
            throw new Error(
              'Final sale was saved but no canonical document journal entry exists. Check [saleAccountingService] logs (blocked non-final, missing accounts, or insert error).'
            );
          }
        }
      }
      
      // Payment JE only for posted (final) sales — draft/quotation/order must not hit GL or AR payment postings
      if (canPostAccountingForSaleStatus(newSale.status) && newSale.paid > 0) {
        try {
          await accounting.recordSalePayment({
          saleId: newSale.id,
          invoiceNo: newSale.invoiceNo,
          customerName: newSale.customerName,
          amount: newSale.paid,
          paymentMethod: newSale.paymentMethod as any,
          });
        } catch (accountingError) {
          console.error('[SALES CONTEXT] ❌ CRITICAL: Payment journal entry failed:', accountingError);
          // Don't block sale creation if payment entry fails (sale entry already created)
          console.warn('[SALES CONTEXT] Warning: Sale created but payment entry failed');
        }
      }

      const createdLabel = docType === 'pos' ? 'POS sale' : docType === 'invoice' ? 'Invoice' : docType === 'quotation' ? 'Quotation' : docType === 'order' ? 'Order' : 'Draft';
      if (convOpts?.conversionSourceId) {
        toast.success(
          `Converted to final ${newSale.invoiceNo}. Source draft/quotation/order is archived (still in database for audit) and hidden from the main list.`
        );
      } else {
        toast.success(`${createdLabel} ${effectiveInvoiceNo} created successfully!`);
      }
      
      // Dispatch event to refresh inventory
      window.dispatchEvent(new CustomEvent('saleSaved', { detail: { saleId: newSale.id } }));
      if (newSale.customerId) {
        window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'customer', entityId: newSale.customerId } }));
      }
      
      return newSale;
    } catch (error: any) {
      console.error('[SALES CONTEXT] Error creating sale:', error);
      toast.error(`Failed to create sale: ${error.message || 'Unknown error'}`);
      throw error;
    }
  };

  // Update sale
  const updateSale = async (id: string, updates: Partial<Sale>): Promise<void> => {
    try {
      // CRITICAL FIX: Handle full sale update (not just status)
      const supabaseUpdates: any = {};
      
      // When converting to Studio, allow updating invoice_no to STD-XXXX (Form sends new number)
      if ((updates as any).is_studio === true && typeof (updates as any).invoiceNo === 'string' && (updates as any).invoiceNo) {
        supabaseUpdates.invoice_no = (updates as any).invoiceNo;
      }
      // When converting draft/quotation/order to final in edit mode, form sends new SL- invoice number – persist it
      else if ((updates.status === 'final' || updates.type === 'invoice') && typeof (updates as any).invoiceNo === 'string' && (updates as any).invoiceNo) {
        const inv = (updates as any).invoiceNo as string;
        if (inv.startsWith('SL-') || inv.startsWith('INV-')) {
          supabaseUpdates.invoice_no = inv;
        }
      }
      // Otherwise preserve invoice_no when editing (no change)

      if (updates.status !== undefined) supabaseUpdates.status = updates.status === 'invoice' ? 'final' : (updates.status as string);
      if (updates.type !== undefined) supabaseUpdates.type = updates.type === 'invoice' ? 'invoice' : 'quotation';
      if (updates.paymentStatus !== undefined) supabaseUpdates.payment_status = updates.paymentStatus;
      if (updates.total !== undefined) supabaseUpdates.total = updates.total;
      if (updates.subtotal !== undefined) supabaseUpdates.subtotal = updates.subtotal;
      if (updates.discount !== undefined) supabaseUpdates.discount_amount = updates.discount;
      if (updates.tax !== undefined) supabaseUpdates.tax_amount = updates.tax;
      if (updates.expenses !== undefined) supabaseUpdates.expenses = updates.expenses;
      // CRITICAL FIX: DO NOT directly update paid_amount in sale
      // paid_amount should ONLY be updated by database trigger from payments table
      // If updates.paid is provided, we'll handle it by creating/updating payment record below
      // if (updates.paid !== undefined) supabaseUpdates.paid_amount = updates.paid; // REMOVED - Use payments table only
      if (updates.due !== undefined) supabaseUpdates.due_amount = updates.due;
      if (updates.date !== undefined) supabaseUpdates.invoice_date = updates.date;
      if (updates.customerName !== undefined) supabaseUpdates.customer_name = updates.customerName;
      // UUID column: empty string is invalid; use null for walk-in / no customer
      if (updates.customer !== undefined) supabaseUpdates.customer_id = (updates.customer === '' || updates.customer == null) ? null : updates.customer;
      if (updates.location !== undefined) {
        // Location is branch_id, need to resolve branch name to ID
        // For now, if it's already a UUID, use it directly
        supabaseUpdates.branch_id = updates.location;
      }
      if (updates.notes !== undefined) supabaseUpdates.notes = updates.notes;
      if ((updates as any).deadline !== undefined) supabaseUpdates.deadline = (updates as any).deadline;
      if (updates.shippingStatus !== undefined) supabaseUpdates.shipping_status = updates.shippingStatus;
      if (updates.paymentMethod !== undefined) {
        supabaseUpdates.payment_method = normalizePaymentMethodForEnum(updates.paymentMethod);
      }
      if (updates.is_studio !== undefined) {
        supabaseUpdates.is_studio = updates.is_studio;
      }
      if ((updates as any).attachments !== undefined) supabaseUpdates.attachments = (updates as any).attachments;
      if ((updates as any).salesmanId !== undefined) {
        const sid = (updates as any).salesmanId;
        supabaseUpdates.salesman_id = (sid === '' || sid === 'none' || sid === '1') ? null : sid;
      }
      if ((updates as any).commissionAmount !== undefined) supabaseUpdates.commission_amount = Number((updates as any).commissionAmount) || 0;
      if ((updates as any).commissionEligibleAmount !== undefined) supabaseUpdates.commission_eligible_amount = (updates as any).commissionEligibleAmount;
      if ((updates as any).commissionPercent !== undefined) supabaseUpdates.commission_percent = (updates as any).commissionPercent != null ? Number((updates as any).commissionPercent) : null;

      // 🔒 CRITICAL FIX: Calculate stock movement DELTA BEFORE updating sale_items
      // This must happen BEFORE sale_items are deleted/updated so we can fetch old items
      const sale = getSaleById(id);
      const newStatusForGate =
        updates.status !== undefined
          ? (updates.status === 'invoice' ? 'final' : String(updates.status))
          : undefined;
      const priorPostedStock = sale != null && canPostStockForSaleStatus(sale.status);
      const willBePostedStock =
        newStatusForGate != null && canPostStockForSaleStatus(newStatusForGate);
      /** Stock deltas: only if already posted or this save moves to posted (finalize + item change). */
      const allowStockItemDeltas = priorPostedStock || willBePostedStock;
      // PF-14: Component-level GL only when sale was already posted before this edit (not draft→final in same payload — handled by finalize paths / service).
      const priorPostedAccounting = sale != null && canPostAccountingForSaleStatus(sale.status);
      const accountingRepostNeeded = priorPostedAccounting && (
        updates.total !== undefined ||
        updates.subtotal !== undefined ||
        updates.discount !== undefined ||
        (updates as any).shippingCharges !== undefined ||
        (updates as any).extraExpenses !== undefined ||
        ((updates as any).items && Array.isArray((updates as any).items))
      );
      let oldAccountingSnapshot: { total: number; subtotal: number; discount: number; extraExpense: number; shippingCharges: number } | null = null;
      if (accountingRepostNeeded && companyId) {
        try {
          const oldSaleForAccounting = await saleService.getSaleById(id);
          const { saleAccountingService: sac } = await import('@/app/services/saleAccountingService');
          oldAccountingSnapshot = sac.getSaleAccountingSnapshot(oldSaleForAccounting);
        } catch (e) {
          console.warn('[SALES CONTEXT] PF-14: Could not capture old accounting snapshot:', e);
        }
      }
      let stockMovementDeltas: Array<{
        productId: string;
        variationId?: string;
        deltaQty: number;
        price: number;
        name: string;
      }> = [];
      
      // Only calculate delta if items are being updated and sale is / will be posted for stock
      if (allowStockItemDeltas && (updates as any).items && Array.isArray((updates as any).items) && companyId) {
        try {
          console.log('[SALES CONTEXT] 🔄 Calculating stock movement DELTA for sale edit (BEFORE items update):', id);
          
          // STEP 1: Fetch OLD items from database (BEFORE they are deleted)
          const { supabase } = await import('@/lib/supabase');
          const { data: oldItemsData, error: oldItemsError } = await supabase
            .from('sales_items')
            .select('product_id, variation_id, quantity, unit_price, product_name')
            .eq('sale_id', id);
          
          if (oldItemsError) {
            console.error('[SALES CONTEXT] Error fetching old items:', oldItemsError);
            // Don't throw - continue without delta calculation
          } else {
            const oldItems = oldItemsData || [];
            const newItems = (updates as any).items || [];
            
            console.log('[SALES CONTEXT] Stock movement delta calculation:', {
              oldItemsCount: oldItems.length,
              newItemsCount: newItems.length,
              oldItems: oldItems.map((i: any) => ({ product_id: i.product_id, variation_id: i.variation_id, qty: i.quantity })),
              newItems: newItems.map((i: any) => ({ product_id: i.productId, variation_id: i.variationId, qty: i.quantity }))
            });
            
            // STEP 2: Build maps for delta calculation
            // Key format: "productId_variationId" (use "null" for no variation)
            type ItemKey = string;
            const oldItemsMap = new Map<ItemKey, { quantity: number; price: number; name: string }>();
            const newItemsMap = new Map<ItemKey, { quantity: number; price: number; name: string }>();
            
            // Map old items
            oldItems.forEach((item: any) => {
              const key: ItemKey = `${item.product_id}_${item.variation_id || 'null'}`;
              oldItemsMap.set(key, {
                quantity: Number(item.quantity) || 0,
                price: Number(item.unit_price) || 0,
                name: item.product_name || 'Unknown'
              });
            });
            
            // Map new items
            newItems.forEach((item: any) => {
              if (item.productId && item.quantity > 0) {
                const key: ItemKey = `${item.productId}_${item.variationId || 'null'}`;
                newItemsMap.set(key, {
                  quantity: Number(item.quantity) || 0,
                  price: Number(item.price) || 0,
                  name: item.productName || 'Unknown'
                });
              }
            });
            
            // STEP 3: Calculate DELTA for each product+variation combination
            // Check all keys (old + new)
            const allKeys = new Set([...oldItemsMap.keys(), ...newItemsMap.keys()]);
            
            allKeys.forEach((key) => {
              const oldItem = oldItemsMap.get(key) || { quantity: 0, price: 0, name: '' };
              const newItem = newItemsMap.get(key) || { quantity: 0, price: 0, name: '' };
              
              const deltaQty = newItem.quantity - oldItem.quantity;
              
              // Only create movement if delta is non-zero
              if (deltaQty !== 0) {
                const [productId, variationIdStr] = key.split('_');
                const variationId = variationIdStr === 'null' ? undefined : variationIdStr;
                
                stockMovementDeltas.push({
                  productId,
                  variationId,
                  deltaQty, // Positive = stock increased (item removed/reduced), Negative = stock decreased (item added/increased)
                  price: newItem.price || oldItem.price || 0,
                  name: newItem.name || oldItem.name || 'Unknown'
                });
                
                console.log('[SALES CONTEXT] Delta calculated:', {
                  key,
                  productId,
                  variationId,
                  oldQty: oldItem.quantity,
                  newQty: newItem.quantity,
                  deltaQty,
                  meaning: deltaQty > 0 ? 'Item removed/reduced (stock restored)' : 'Item added/increased (stock reduced)'
                });
              }
            });
          }
        } catch (deltaError: any) {
          console.error('[SALES CONTEXT] ❌ Delta calculation error:', deltaError);
          // Don't block sale update if delta calculation fails
        }
      }

      // Negative stock enforcement: company-level setting from DB only (same for all users)
      const reducingDeltas = stockMovementDeltas.filter((d) => d.deltaQty < 0);
      const allowNegativeUpdate = companyId
        ? await import('@/app/services/settingsService').then(m => m.settingsService.getAllowNegativeStock(companyId))
        : false;
      if (!allowNegativeUpdate && reducingDeltas.length > 0 && companyId) {
        const { supabase } = await import('@/lib/supabase');
        const productIds = [...new Set(reducingDeltas.map((d) => d.productId))];
        const [stockMap, { data: prods }] = await Promise.all([
          productService.getStockForProducts(productIds, companyId, effectiveBranchId ?? undefined),
          supabase.from('products').select('id, has_variations').in('id', productIds),
        ]);
        const productMap = new Map((prods || []).map((p: any) => [p.id, p]));

        for (const delta of reducingDeltas) {
          const p = productMap.get(delta.productId) as { has_variations?: boolean } | undefined;
          if (!p) continue;
          const key = delta.variationId ? `${delta.productId}:${delta.variationId}` : `${delta.productId}:`;
          const stock = stockMap.get(key) ?? 0;
          const qtyNeeded = Math.abs(delta.deltaQty);
          if (stock < qtyNeeded) {
            throw new Error(
              `${delta.name}: quantity (${qtyNeeded}) exceeds available stock (${stock}). ` +
              'To allow this, enable "Negative Stock Allowed" in Settings → Inventory.'
            );
          }
        }
      }

      // CRITICAL FIX: Update sale items if provided
      if ((updates as any).items && Array.isArray((updates as any).items)) {
        const { saleService } = await import('@/app/services/saleService');
        console.log('[SALES CONTEXT] 🔄 Updating sale items. Received items count:', (updates as any).items.length);
        console.log('[SALES CONTEXT] Items payload:', (updates as any).items.map((item: any, idx: number) => ({
          index: idx,
          id: item.id,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          price: item.price || item.unitPrice
        })));
        
        const saleItems = (updates as any).items.map((item: any, index: number) => {
          const unitPrice = Number(item.unitPrice ?? item.price ?? 0);
          const lineTotal = Number(item.total ?? (unitPrice * item.quantity) ?? 0);
          const saleItem = {
          product_id: item.productId,
          variation_id: item.variationId || undefined,
          product_name: item.productName,
          sku: item.sku || 'N/A',
          quantity: item.quantity,
          unit: item.unit || 'pcs',
          unit_price: unitPrice,
          discount_amount: item.discount || 0,
          tax_amount: item.tax || 0,
          total: lineTotal,
          packing_type: item.packingDetails?.packing_type || null,
          packing_quantity: item.packingDetails?.total_meters || item.meters || null,
          packing_unit: item.packingDetails?.unit || 'meters',
          packing_details: item.packingDetails || null,
        };
        console.log(`[SALES CONTEXT] ✅ Converted item ${index}:`, {
          product_id: saleItem.product_id,
          product_name: saleItem.product_name,
          quantity: saleItem.quantity,
          unit_price: saleItem.unit_price
        });
        return saleItem;
        });
        
        console.log('[SALES CONTEXT] ✅ Final saleItems array length:', saleItems.length);
        
        // Delete existing items and insert new ones
        const { supabase } = await import('@/lib/supabase');
        const { error: deleteError } = await supabase.from('sales_items').delete().eq('sale_id', id);
        if (deleteError) {
          console.error('[SALES CONTEXT] ❌ Error deleting old items:', deleteError);
          throw deleteError;
        }
        console.log('[SALES CONTEXT] ✅ Deleted old sale_items');
        
        if (saleItems.length > 0) {
          const itemsWithSaleId = saleItems.map((item: any) => ({ ...item, sale_id: id }));
          console.log('[SALES CONTEXT] 🔄 Inserting', itemsWithSaleId.length, 'new sale_items');
          const { error: insertError } = await supabase.from('sales_items').insert(itemsWithSaleId);
          if (insertError) {
            console.error('[SALES CONTEXT] ❌ Error inserting new items:', insertError);
            throw insertError;
          }
          console.log('[SALES CONTEXT] ✅ Successfully inserted', itemsWithSaleId.length, 'sale_items');
        } else {
          console.log('[SALES CONTEXT] ⚠️ No items to insert (saleItems.length = 0)');
        }
      }

      // 🔒 CRITICAL FIX: Create stock movements for DELTA (after sale_items are updated)
      // GOLDEN RULE: Only create movements for the delta, not for all items
      if (stockMovementDeltas.length > 0 && companyId) {
        try {
          const { supabase: sb } = await import('@/lib/supabase');
          const { data: { user: authUser } } = await sb.auth.getUser();
          const updateCreatedByAuthId = authUser?.id ?? (user as any)?.auth_user_id ?? user?.id;

          console.log('[SALES CONTEXT] 🔄 Creating stock movements for deltas:', stockMovementDeltas.length);
          
          // Get branch ID
          let effectiveBranchId = isValidBranchId(branchId) ? branchId : null;
          if (!effectiveBranchId && companyId) {
            const branches = await branchService.getAllBranches(companyId);
            effectiveBranchId = branches?.length ? branches[0].id : null;
          }
          
          // Create stock movements for DELTA only
          const stockMovementErrors: string[] = [];
          const saleForStock = sale || (await saleService.getSaleById(id));
          const saleInvoiceNo = saleForStock?.invoiceNo || id;
          
          for (const delta of stockMovementDeltas) {
            try {
              // deltaQty > 0 means item was removed/reduced → restore stock (positive movement)
              // deltaQty < 0 means item was added/increased → reduce stock (negative movement)
              const movementQty = -delta.deltaQty; // Negate because: if deltaQty is positive (item removed), we restore stock (positive movement)
              
              console.log('[SALES CONTEXT] Creating stock movement for delta:', {
                product_id: delta.productId,
                variation_id: delta.variationId,
                deltaQty: delta.deltaQty,
                movementQty: movementQty,
                sale_id: id
              });
              
              // Create stock movement
              const movement = await productService.createStockMovement({
                company_id: companyId,
                branch_id: effectiveBranchId === 'all' ? undefined : effectiveBranchId,
                product_id: delta.productId,
                variation_id: delta.variationId,
                movement_type: 'sale',
                quantity: movementQty, // Positive = restore stock, Negative = reduce stock
                unit_cost: delta.price,
                total_cost: movementQty * delta.price,
                reference_type: 'sale',
                reference_id: id,
                notes: `Sale Edit ${saleInvoiceNo} - ${delta.name}${delta.variationId ? ' (Variation)' : ''} - Delta: ${delta.deltaQty > 0 ? 'Restore' : 'Reduce'}`,
                created_by: updateCreatedByAuthId,
              });
              
              if (!movement || !movement.id) {
                throw new Error(`Stock movement creation returned null for product ${delta.productId}`);
              }
              
              console.log('[SALES CONTEXT] ✅ Stock movement created for delta:', delta.name, 'Movement ID:', movement.id, 'Qty:', movementQty);
            } catch (movementError: any) {
              const errorMsg = `Failed to create stock movement for ${delta.name}: ${movementError.message || movementError}`;
              console.error('[SALES CONTEXT] ❌', errorMsg);
              stockMovementErrors.push(errorMsg);
              // Continue with other deltas even if one fails
            }
          }
          
          if (stockMovementErrors.length > 0) {
            console.error('[SALES CONTEXT] ⚠️ Some stock movements failed:', stockMovementErrors);
            toast.warning(`Sale updated but ${stockMovementErrors.length} stock movement(s) failed. Check console for details.`);
          } else {
            console.log('[SALES CONTEXT] ✅ All stock movement deltas created successfully for sale:', id, 'Deltas:', stockMovementDeltas.length);
          }
          
          // Dispatch event to refresh inventory
          window.dispatchEvent(new CustomEvent('saleSaved', { 
            detail: { saleId: id } 
          }));
          const custId = sale?.customerId || (sale as any)?.customer_id;
          if (custId) {
            window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'customer', entityId: custId } }));
          }
        } catch (stockError: any) {
          console.error('[SALES CONTEXT] ❌ Stock movement delta creation error:', stockError);
          toast.warning('Sale updated but stock movements failed. Check console for details.');
          // Don't block update if stock movement fails
        }
      } else if (stockMovementDeltas.length === 0 && allowStockItemDeltas && (updates as any).items) {
        console.log('[SALES CONTEXT] ✅ No stock movement delta (items unchanged or no delta)');
      }

      // Order/Draft/Quotation → Final: create stock OUT for all items when only status is being updated (no item deltas)
      const wasNotFinal = sale != null && !canPostStockForSaleStatus(sale.status);
      const isNowFinal =
        newStatusForGate != null && canPostStockForSaleStatus(newStatusForGate);
      const effectiveCompanyId = companyId || (sale as any)?.company_id;
      if (wasNotFinal && isNowFinal && stockMovementDeltas.length === 0 && effectiveCompanyId) {
        try {
          const { supabase: sb } = await import('@/lib/supabase');
          let currentItems: { product_id: string; variation_id?: string; quantity: number; unit_price?: number; product_name?: string }[] = [];
          const { data: itemsFromSalesItems, error: itemsErr } = await sb
            .from('sales_items')
            .select('product_id, variation_id, quantity, unit_price, product_name')
            .eq('sale_id', id);
          if (!itemsErr && itemsFromSalesItems?.length) {
            currentItems = itemsFromSalesItems;
          } else {
            const { data: itemsFromSaleItems } = await sb
              .from('sale_items')
              .select('product_id, variation_id, quantity, unit_price, product_name')
              .eq('sale_id', id);
            if (itemsFromSaleItems?.length) currentItems = itemsFromSaleItems;
          }
          if (currentItems.length > 0) {
            const { data: { user: authUser } } = await sb.auth.getUser();
            const updateCreatedByAuthId = authUser?.id ?? (user as any)?.auth_user_id ?? user?.id;
            const saleForStock = sale || (await saleService.getSaleById(id));
            const saleInvoiceNo = (saleForStock as any)?.invoice_no ?? (saleForStock as any)?.invoiceNo ?? id;
            const saleBranchId = (saleForStock as any)?.branch_id ?? null;
            let effectiveBranchId = isValidBranchId(saleBranchId) ? saleBranchId : (isValidBranchId(branchId) ? branchId : null);
            if (!effectiveBranchId) {
              const branches = await branchService.getAllBranches(effectiveCompanyId);
              effectiveBranchId = branches?.length ? branches[0].id : null;
            }
            if (effectiveBranchId === 'all') effectiveBranchId = null;
            for (const item of currentItems) {
              const qty = Number(item.quantity) || 0;
              if (qty <= 0) continue;
              const productId = item.product_id;
              const variationId = item.variation_id || undefined;
              const { data: prod } = await sb.from('products').select('id, product_type').eq('id', productId).maybeSingle();
              if ((prod as any)?.product_type === 'production') {
                const { data: existingProd } = await sb
                  .from('stock_movements')
                  .select('id')
                  .eq('product_id', productId)
                  .eq('company_id', effectiveCompanyId)
                  .eq('movement_type', 'production')
                  .limit(1);
                if (!existingProd?.length) {
                  await productService.createStockMovement({
                    company_id: effectiveCompanyId,
                    branch_id: effectiveBranchId ?? undefined,
                    product_id: productId,
                    variation_id: variationId,
                    movement_type: 'production',
                    quantity: 1,
                    unit_cost: 0,
                    reference_type: 'sale',
                    reference_id: id,
                    notes: `Studio sale ${saleInvoiceNo} – production product (backfill)`,
                    created_by: updateCreatedByAuthId ?? undefined,
                  });
                }
              }
              await productService.createStockMovement({
                company_id: effectiveCompanyId,
                branch_id: effectiveBranchId ?? undefined,
                product_id: productId,
                variation_id: variationId,
                movement_type: 'sale',
                quantity: -qty,
                unit_cost: Number(item.unit_price) || 0,
                reference_type: 'sale',
                reference_id: id,
                notes: `Sale ${saleInvoiceNo} – ${(item as any).product_name || 'Item'}`,
                created_by: updateCreatedByAuthId ?? undefined,
              });
            }
            console.log('[SALES CONTEXT] ✅ Stock OUT created for Order→Final (no item change):', currentItems.length, 'items');
            window.dispatchEvent(new CustomEvent('saleSaved', { detail: { saleId: id } }));
            const custId = sale?.customerId ?? (saleForStock as any)?.customer_id;
            if (custId) window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'customer', entityId: custId } }));
          }
        } catch (orderToFinalErr: any) {
          console.error('[SALES CONTEXT] Order→Final stock movements error:', orderToFinalErr);
          toast.warning('Sale marked Final but some stock movements failed. Check stock ledger.');
        }
      }

      // Update in Supabase
      if (Object.keys(supabaseUpdates).length > 0) {
        await saleService.updateSale(id, supabaseUpdates);
      }

      // Line-level charges: extraExpenses + standalone shipping + discount (replace sale_charges on edit)
      const extraExpensesList = (updates as any).extraExpenses;
      const updateShippingCharges = Number((updates as any).shippingCharges ?? 0);
      const hasCharges = Array.isArray(extraExpensesList) || updateShippingCharges > 0;
      if (hasCharges) {
        const charges: { charge_type: string; amount: number; ledger_account_id?: string | null }[] = [];
        if (Array.isArray(extraExpensesList)) {
          extraExpensesList.forEach((e: { type?: string; amount?: number }) => {
            const amt = Number(e?.amount ?? 0);
            if (amt > 0) charges.push({ charge_type: (e?.type ?? 'other') as string, amount: amt });
          });
        }
        if (updateShippingCharges > 0) charges.push({ charge_type: 'shipping', amount: updateShippingCharges });
        const discountAmt = Number((updates as any).discount ?? updates.discount_amount ?? 0);
        if (discountAmt > 0) charges.push({ charge_type: 'discount', amount: discountAmt });
        await saleService.replaceSaleCharges(id, charges, user?.id ?? undefined);
      }

      // PF-03: Sync shipping charge to sale_shipments so trigger updates sales.shipment_charges and due_amount (single source of truth)
      if ((updates as any).shippingCharges !== undefined && companyId) {
        try {
          const shipments = await shipmentService.getBySaleId(id);
          let effectiveBranchId = isValidBranchId(branchId) ? branchId : (sale?.location ?? null);
          if (!effectiveBranchId && companyId) {
            const branches = await branchService.getAllBranches(companyId);
            effectiveBranchId = branches?.length ? branches[0].id : null;
          }
          if (shipments.length > 0) {
            await shipmentService.update(shipments[0].id, { charged_to_customer: updateShippingCharges }, user?.id ?? undefined);
            console.log('[SALES CONTEXT] PF-03: Updated first shipment charged_to_customer, trigger will sync sale shipment_charges and due_amount');
          } else if (updateShippingCharges > 0 && effectiveBranchId) {
            await shipmentService.create(
              id,
              companyId,
              effectiveBranchId,
              { shipment_type: 'Courier', charged_to_customer: updateShippingCharges, actual_cost: 0, currency: 'PKR', shipment_status: 'Pending' },
              user?.id ?? undefined,
              sale?.invoiceNo ?? undefined
            );
            console.log('[SALES CONTEXT] PF-03: Created shipment for shipping charge, trigger will sync sale shipment_charges and due_amount');
          }
        } catch (shipSyncErr: any) {
          console.warn('[SALES CONTEXT] PF-03: Shipment sync for shipping charge failed:', shipSyncErr?.message);
        }
      }

      // PF-14: Posted sale edit — NEVER delete original JEs. Post only delta adjustment JEs per component.
      if (accountingRepostNeeded && companyId && oldAccountingSnapshot) {
        try {
          const updatedSale = await saleService.getSaleById(id);
          if (!updatedSale) throw new Error('Sale not found after update');
          const { saleAccountingService: sac } = await import('@/app/services/saleAccountingService');
          const newSnapshot = sac.getSaleAccountingSnapshot(updatedSale);
          const invoiceNo = (updatedSale as any).invoice_no ?? (updatedSale as any).invoiceNo ?? id;
          const entryDate = ((updatedSale as any).invoice_date ?? (updatedSale as any).date ?? new Date().toISOString().slice(0, 10)).toString().slice(0, 10);
          let effectiveBranchId = isValidBranchId(branchId) ? branchId : ((updatedSale as any).branch_id && (updatedSale as any).branch_id !== 'all') ? (updatedSale as any).branch_id : null;
          if (!effectiveBranchId && companyId) {
            const branches = await branchService.getAllBranches(companyId);
            effectiveBranchId = branches?.length ? branches[0].id : null;
          }
          const createdByAuthId = (user as any)?.id ?? (user as any)?.auth_user_id ?? null;
          const { adjustmentCount } = await sac.postSaleEditAdjustments({
            companyId,
            branchId: effectiveBranchId,
            saleId: id,
            invoiceNo,
            entryDate,
            createdBy: createdByAuthId,
            oldSnapshot: oldAccountingSnapshot,
            newSnapshot,
          });
          if (adjustmentCount > 0) {
            console.log('[SALES CONTEXT] PF-14: Posted', adjustmentCount, 'sale adjustment JE(s); original JEs unchanged.');
            window.dispatchEvent(new CustomEvent('accountingEntriesChanged'));
          }

          // Phase 4: Activity only when value actually changed (no misleading or duplicate entries)
          const logComponent = (field: string, oldVal: number, newVal: number, label: string) => {
            if (oldVal === newVal) return;
            activityLogService.logActivity({
              companyId,
              module: 'sale',
              entityId: id,
              entityReference: invoiceNo,
              action: 'sale_component_edited',
              field: label,
              oldValue: oldVal,
              newValue: newVal,
              performedBy: createdByAuthId ?? undefined,
              description: `${label} changed from Rs ${Number(oldVal).toLocaleString()} to Rs ${Number(newVal).toLocaleString()}`,
            }).catch((e) => console.warn('[SALES CONTEXT] Activity log sale_component_edited failed:', e));
          };
          logComponent('discount', oldAccountingSnapshot.discount, newSnapshot.discount, 'Discount');
          logComponent('shipping', oldAccountingSnapshot.shippingCharges, newSnapshot.shippingCharges, 'Shipping');
          logComponent('extra_expense', oldAccountingSnapshot.extraExpense, newSnapshot.extraExpense, 'Extra expense');
          const oldTotal = oldAccountingSnapshot.total;
          const newTotal = newSnapshot.total;
          if (oldTotal !== newTotal) {
            activityLogService.logActivity({
              companyId,
              module: 'sale',
              entityId: id,
              entityReference: invoiceNo,
              action: 'sale_component_edited',
              field: 'Total',
              oldValue: oldTotal,
              newValue: newTotal,
              performedBy: createdByAuthId ?? undefined,
              description: `Total changed from Rs ${Number(oldTotal).toLocaleString()} to Rs ${Number(newTotal).toLocaleString()}`,
            }).catch((e) => console.warn('[SALES CONTEXT] Activity log sale total failed:', e));
          }
        } catch (adjErr: any) {
          console.error('[SALES CONTEXT] PF-14: Sale edit adjustment posting failed:', adjErr);
          toast.warning('Sale updated, but accounting adjustments failed. Check logs.');
        }
      }

      // Commission: NOT posted per sale on update. Batch posting only via Commission Report.

      // 🔒 GOLDEN RULE: Payment MUST go to payments table, NEVER directly update sale.paid_amount
      // If updates.paid is provided, create/update payment record in payments table
      // Database trigger will automatically update sale.paid_amount from payments table
      if (updates.paid !== undefined) {
        try {
          const saleForSync = getSaleById(id);
          if (!saleForSync || !companyId) {
            console.warn('[SALES CONTEXT] Cannot sync payment: sale or company missing');
          } else {
            const existingPayments = await saleService.getSalePayments(id);
            const paidAmount = Number(updates.paid) || 0;
            const paymentMethod = updates.paymentMethod || saleForSync?.paymentMethod || 'Cash';
            
            let effectiveBranchId = isValidBranchId(branchId) ? branchId : null;
            if (!effectiveBranchId && companyId) {
              const branches = await branchService.getAllBranches(companyId);
              effectiveBranchId = branches?.length ? branches[0].id : null;
            }
            
            if (companyId && effectiveBranchId && user) {
              const { accountHelperService } = await import('@/app/services/accountHelperService');
              const { accountService } = await import('@/app/services/accountService');
              const normalizedMethod = normalizePaymentMethodForEnum(paymentMethod);
              
              // Get payment account ID
              let paymentAccountId = await accountHelperService.getDefaultAccountByPaymentMethod(normalizedMethod, companyId);
              if (!paymentAccountId) {
                const allAccounts = await accountService.getAllAccounts(companyId);
                paymentAccountId = allAccounts?.find((acc: any) => acc.code === '1000')?.id || null;
              }
              
              if (!paymentAccountId) {
                console.error('[SALES CONTEXT] No payment account found for', normalizedMethod);
                throw new Error(`No payment account found for ${normalizedMethod}. Please create a default account.`);
              }
              
              // Phase 3: Only touch payment when paid or account actually changed (document-only edit must not repost payment)
              const existingSum = existingPayments.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
              const paymentUnchanged = existingPayments.length === 1 &&
                Math.round((paidAmount - (Number(existingPayments[0].amount) || 0)) * 100) === 0 &&
                (existingPayments[0].payment_account_id === paymentAccountId || !existingPayments[0].payment_account_id);

              if (existingPayments.length === 0 && paidAmount > 0) {
                await saleService.recordPayment(
                  id,
                  paidAmount,
                  paymentMethod,
                  paymentAccountId,
                  companyId,
                  effectiveBranchId,
                  saleForSync.date,
                  undefined
                );
                console.log('[SALES CONTEXT] ✅ Payment record created in payments table');
              } else if (existingPayments.length === 1 && !paymentUnchanged) {
                await saleService.updatePayment(
                  existingPayments[0].id,
                  id,
                  {
                    amount: paidAmount,
                    paymentMethod: normalizedMethod,
                    accountId: paymentAccountId,
                  }
                );
                console.log('[SALES CONTEXT] ✅ Payment record updated in payments table');
              } else if (existingPayments.length === 1 && paymentUnchanged) {
                if (import.meta.env?.DEV) console.log('[SALES CONTEXT] Phase 3: Payment unchanged, skipping update');
              } else if (existingPayments.length > 1) {
                console.warn('[SALES CONTEXT] Multiple payments exist, cannot auto-update. Use payment management UI.');
              }
            }
          }
        } catch (syncErr: any) {
          console.error('[SALES CONTEXT] ❌ Payment sync failed:', syncErr);
          // Don't block sale update if payment sync fails, but log error
          toast.error(`Payment sync failed: ${syncErr.message || 'Unknown error'}`);
        }
      }

      // CRITICAL FIX: Handle payments if provided in updates
      // When editing, existing payments should NOT be recreated
      // Only new payments (not marked as existing) should be created
      if ((updates as any).partialPayments && Array.isArray((updates as any).partialPayments)) {
        const partialPayments = (updates as any).partialPayments;
        const newPayments = partialPayments.filter((p: any) => !p.isExisting);
        let updateBranchId = isValidBranchId(branchId) ? branchId : null;
        if (!updateBranchId && companyId) {
          const branches = await branchService.getAllBranches(companyId);
          updateBranchId = branches?.length ? branches[0].id : null;
        }
        if (newPayments.length > 0 && companyId && updateBranchId && user) {
          try {
            const { accountHelperService } = await import('@/app/services/accountHelperService');
            const { saleService } = await import('@/app/services/saleService');
            const { accountService } = await import('@/app/services/accountService');
            
            for (const partialPayment of newPayments) {
              const paymentMethod = normalizePaymentMethodForEnum(partialPayment.method || 'cash');
              
              // Get account for this payment method
              let paymentAccountId = await accountHelperService.getDefaultAccountByPaymentMethod(
                paymentMethod,
                companyId
              );
              
              // If no account found, use Cash as default
              if (!paymentAccountId) {
                const allAccounts = await accountService.getAllAccounts(companyId);
                const cashAccount = allAccounts.find(acc => acc.code === '1000');
                paymentAccountId = cashAccount?.id || null;
              }
              
              if (paymentAccountId && partialPayment.amount > 0) {
                await saleService.recordPayment(
                  id,
                  partialPayment.amount,
                  paymentMethod,
                  paymentAccountId,
                  companyId,
                  updateBranchId,
                  undefined,
                  undefined
                );
                // Create separate journal entry for this payment
                accounting.recordSalePayment({
                  saleId: id,
                  invoiceNo: sale?.invoiceNo || '',
                  customerName: sale?.customerName || '',
                  amount: partialPayment.amount,
                  paymentMethod: paymentMethod as any,
                  accountId: paymentAccountId,
                });
              }
            }
          } catch (error: any) {
            console.error('[SALES CONTEXT] Error recording new payments during edit:', error);
            // Don't fail update if payment recording fails
          }
        }
      }
      
      // CRITICAL FIX: Reload sale from database to get fresh data
      const updatedSaleData = await saleService.getSaleById(id);
      if (updatedSaleData) {
        const updatedSale = convertFromSupabaseSale(updatedSaleData);
        setSales(prev => prev.map(s => s.id === id ? updatedSale : s));
      } else {
        // Fallback: Update local state
      setSales(prev => prev.map(sale => 
        sale.id === id 
          ? { ...sale, ...updates, updatedAt: new Date().toISOString() }
          : sale
      ));
      }
      // Activity log: detail of what changed (use sale from start of update, before state refresh)
      if (companyId && user?.id && sale) {
        const changes: string[] = [];
        if (updates.total !== undefined && Number(sale.total) !== Number(updates.total)) {
          changes.push(`Total changed from Rs ${Number(sale.total).toLocaleString()} to Rs ${Number(updates.total).toLocaleString()}`);
        }
        if (updates.discount !== undefined && Number(sale.discount) !== Number(updates.discount)) {
          changes.push(`Discount from Rs ${Number(sale.discount).toLocaleString()} to Rs ${Number(updates.discount).toLocaleString()}`);
        }
        if (updates.expenses !== undefined && Number(sale.expenses) !== Number(updates.expenses)) {
          changes.push(`Expenses from Rs ${Number(sale.expenses).toLocaleString()} to Rs ${Number(updates.expenses).toLocaleString()}`);
        }
        if (updates.status !== undefined && sale.status !== updates.status) {
          changes.push(`Status from ${sale.status} to ${updates.status}`);
        }
        if ((updates as any).items && Array.isArray((updates as any).items) && (sale.itemsCount ?? sale.items?.length) !== (updates as any).items?.length) {
          changes.push(`Items count from ${sale.itemsCount ?? sale.items?.length ?? 0} to ${(updates as any).items.length}`);
        }
        if (updates.notes !== undefined && sale.notes !== updates.notes) changes.push('Notes updated');
        const description = changes.length > 0 ? changes.join('; ') : 'Sale updated';
        activityLogService.logActivity({
          companyId,
          module: 'sale',
          entityId: id,
          entityReference: sale.invoiceNo,
          action: 'update',
          performedBy: user.id,
          description,
        }).catch((err) => console.warn('[SALES CONTEXT] Activity log failed:', err));
      }

      // POS updates show their own toast; avoid duplicate for POS invoices
      const isPOS = getSaleById(id)?.invoiceNo?.startsWith('POS-');
      if (!isPOS) toast.success('Sale updated successfully!');
      // Notify views (e.g. Studio Sale Detail, Studio Sales List) to refetch so UI shows updated data
      window.dispatchEvent(new CustomEvent('saleUpdated', { detail: { saleId: id } }));
    } catch (error: any) {
      console.error('[SALES CONTEXT] Error updating sale:', error);
      toast.error(`Failed to update sale: ${error.message || 'Unknown error'}`);
      throw error;
    }
  };

  // Delete sale
  const deleteSale = async (id: string): Promise<void> => {
    const sale = getSaleById(id);
    if (!sale) {
      throw new Error('Sale not found');
    }

    try {
      // CRITICAL FIX: Use hard delete since 'cancelled' status doesn't exist in enum
      // sale_status enum only supports: draft, quotation, order, final
      await saleService.deleteSale(id);
      
      // Update local state
      setSales(prev => prev.filter(s => s.id !== id));
      
      // CRITICAL: Dispatch event to refresh ledger views and accounting
      window.dispatchEvent(new CustomEvent('saleDeleted', { detail: { saleId: id } }));
      const custId = sale.customerId || (sale as any)?.customer;
      if (custId) {
        window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'customer', entityId: custId } }));
      }
      
      toast.success(`${sale.invoiceNo} deleted successfully!`);
    } catch (error: any) {
      console.error('[SALES CONTEXT] Error deleting sale:', error);
      toast.error(`Failed to delete sale: ${error.message || 'Unknown error'}`);
      throw error;
    }
  };

  // Record payment
  const recordPayment = async (saleId: string, amount: number, method: string, accountId?: string): Promise<void> => {
    const sale = getSaleById(saleId);
    if (!sale || !companyId) {
      throw new Error('Sale not found or company missing');
    }
    let effectiveBranchId = isValidBranchId(branchId) ? branchId : null;
    if (!effectiveBranchId) {
      const branches = await branchService.getAllBranches(companyId);
      if (!branches?.length) throw new Error('No branch found. Please create at least one branch.');
      effectiveBranchId = branches[0].id;
    }

    try {
      // CRITICAL FIX: Get account ID from payment method if not provided
      let paymentAccountId = accountId;
      
      if (!paymentAccountId && companyId) {
        const { accountHelperService } = await import('@/app/services/accountHelperService');
        paymentAccountId = await accountHelperService.getDefaultAccountByPaymentMethod(
          method,
          companyId
        ) || null;
      }
      
      // If still no account, throw error
      if (!paymentAccountId) {
        throw new Error(`No account found for ${method} payment. Please create a default account.`);
      }
      
      // Record payment in Supabase; let DB trigger set reference_number (avoid duplicate key)
      await saleService.recordPayment(saleId, amount, method, paymentAccountId, companyId, effectiveBranchId, undefined, undefined);

      // CRITICAL FIX: Reload sale to get updated paid/due amounts from database (trigger updated them)
      // Don't manually calculate - let database trigger handle it
      const updatedSaleData = await saleService.getSaleById(saleId);
      if (updatedSaleData) {
        const updatedSale = convertFromSupabaseSale(updatedSaleData);
        setSales(prev => prev.map(s => s.id === saleId ? updatedSale : s));
      }

      // CRITICAL FIX: Create journal entry ONLY (payment already recorded above)
      // DO NOT call recordPayment again - it's already done
      accounting.recordSalePayment({
        saleId: sale.id, // CRITICAL FIX: UUID for reference_id
        invoiceNo: sale.invoiceNo, // Invoice number for referenceNo
        customerName: sale.customerName,
        amount,
        paymentMethod: method as any,
        accountId: paymentAccountId, // CRITICAL: Pass account ID
      });

      toast.success(`Payment of ${formatCurrency(amount)} recorded!`);
    } catch (error: any) {
      console.error('[SALES CONTEXT] Error recording payment:', error);
      toast.error(`Failed to record payment: ${error.message || 'Unknown error'}`);
      throw error;
    }
  };

  // Update shipping status
  const updateShippingStatus = async (saleId: string, status: ShippingStatus): Promise<void> => {
    const sale = getSaleById(saleId);
    if (!sale) {
      throw new Error('Sale not found');
    }

    try {
      await updateSale(saleId, { shippingStatus: status });
      
      // CRITICAL FIX: Update local state immediately for instant UI feedback
      setSales(prev => prev.map(s => 
        s.id === saleId ? { ...s, shippingStatus: status } : s
      ));
      
      // Also refresh from database to ensure consistency
      await loadSales();
      
      toast.success(`Shipping status updated to ${status}!`);
    } catch (error) {
      throw error;
    }
  };

  // Convert quotation (or draft/order) to invoice — same canonical flow as SaleForm convert: NEW final row + archive source
  const convertQuotationToInvoice = async (quotationId: string): Promise<Sale> => {
    try {
      const full = await saleService.getSaleById(quotationId);
      if (!full) throw new Error('Sale not found');
      const q = convertFromSupabaseSale(full);
      const charges = q.charges || [];
      const extraExpenses = charges
        .filter((c: any) => (c.charge_type || c.chargeType) !== 'shipping' && (c.charge_type || c.chargeType) !== 'discount')
        .map((c: any) => ({
          type: (c.charge_type || c.chargeType || 'other') as string,
          amount: Number(c.amount) || 0,
        }));
      const shippingFromCharges = charges
        .filter((c: any) => (c.charge_type || c.chargeType) === 'shipping')
        .reduce((s: number, c: any) => s + (Number(c.amount) || 0), 0);
      const saleData: Omit<Sale, 'id' | 'invoiceNo' | 'createdAt' | 'updatedAt'> = {
        type: 'invoice',
        status: 'final',
        customer: q.customer,
        customerName: q.customerName,
        contactNumber: q.contactNumber || '',
        date: q.date,
        location: q.location,
        items: q.items,
        itemsCount: q.itemsCount,
        subtotal: q.subtotal,
        discount: q.discount,
        tax: q.tax,
        expenses: q.expenses,
        total: q.total,
        paid: q.paid,
        due: q.due,
        returnDue: q.returnDue,
        paymentStatus: q.paymentStatus,
        paymentMethod: q.paymentMethod,
        shippingStatus: q.shippingStatus as ShippingStatus,
        notes: q.notes,
        extraExpenses,
        shippingCharges: shippingFromCharges || q.shippingCharges || 0,
        partialPayments: [],
        isStudioSale: false,
        is_studio: false,
        commissionAmount: q.commissionAmount,
        salesmanId: q.salesmanId,
        commissionPercent: q.commissionPercent,
      } as any;
      return await createSale(saleData, { conversionSourceId: quotationId });
    } catch (error: any) {
      console.error('[SALES CONTEXT] Error converting quotation:', error);
      toast.error(`Failed to convert: ${error.message || 'Unknown error'}`);
      throw error;
    }
  };

  const value = useMemo<SalesContextType>(() => ({
    sales,
    loading,
    totalCount,
    page,
    pageSize,
    setPage,
    getSaleById,
    createSale,
    updateSale,
    deleteSale,
    recordPayment,
    updateShippingStatus,
    convertQuotationToInvoice,
    refreshSales: loadSales,
  }), [
    sales, loading, totalCount, page, pageSize, setPage, getSaleById, createSale, updateSale, deleteSale,
    recordPayment, updateShippingStatus, convertQuotationToInvoice, loadSales,
  ]);

  return (
    <SalesContext.Provider value={value}>
      {children}
    </SalesContext.Provider>
  );
};
