import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  X, 
  Search, 
  Plus, 
  Trash2, 
  Calendar as CalendarIcon, 
  Save, 
  CreditCard, 
  Banknote,
  FileText,
  User,
  Package,
  ArrowRight,
  Check, 
  ChevronsUpDown,
  Box,
  Layers,
  Ruler,
  Wallet,
  ArrowDownCircle,
  AlertCircle,
  ShoppingBag,
  DollarSign,
  Truck,
  Percent,
  UserCheck,
  Printer,
  Paperclip,
  Palette,
  Scissors,
  Sparkles,
  Building2,
  Lock,
  Edit,
  ChevronRight,
  Hash,
  Tag,
  Upload,
  MapPin,
  ExternalLink
} from 'lucide-react';
import { format, parseISO } from "date-fns";
import { buildNotesWithStudioDeadline, parseStudioDeadlineFromNotes, getStudioDeadlineFromNotes } from "@/app/utils/studioDeadlineNotes";
import { readSaleBillRef } from "@/app/utils/saleBillRef";
import { mergeCustomerBillRefIntoNotes } from "@/app/utils/saleNotesComposition";
import { canAssignSaleCommission } from '@/app/lib/executiveDashboardAccess';
import { cn, formatDateWithTimezone } from "../ui/utils";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Separator } from "../ui/separator";
import { Badge } from "../ui/badge";
import { DateTimePicker, dateToDateTimePickerValue, dateTimePickerValueToDate } from "../ui/DateTimePicker";
import { DatePicker } from "../ui/DatePicker";
import { formatLocalDateYYYYMMDD, parseLocalDateInput } from '@/app/utils/localDate';
import { SearchableSelect } from "../ui/searchable-select";
import { InlineVariationSelector, Variation } from "../ui/inline-variation-selector";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
  } from "../ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "../ui/popover";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "../ui/alert-dialog";
import { PackingDetails } from '../transactions/PackingEntryModal';
import { BespokeDetailsModal } from '../bespoke/BespokeDetailsModal';
import { parseCustomizationDetails, deriveBaseUnitPriceFromStored, resolveSaleLineUnitPrice, buildCustomizationDetailsForPersist, buildBespokeMetadataForPersist, type CustomizationDetails } from '@/app/types/bespoke';
import type { BespokeInjectionPayload } from '@/app/lib/bespokeCartInjection';
import {
  syncFabricChildLines,
  orderSaleLinesForPersist,
  hydrateFabricDraftsFromChildren,
  isInjectedBespokeLine,
  resolveFabricMaterialRetailPrice,
} from '@/app/lib/bespokeCartInjection';
import { toast } from "sonner";
import { webSaveTimingMark, webSaveTimingStart } from '@/app/lib/webSaveTiming';
import { BranchSelector } from '@/app/components/layout/BranchSelector';
import { SaleItemsSection } from './SaleItemsSection';
import { PaymentAttachments, PaymentAttachment } from '../payments/PaymentAttachments';
import { UnifiedPaymentDialog } from '@/app/components/shared/UnifiedPaymentDialog';
import { uploadSaleAttachments, MAX_FILE_SIZE_BYTES as ATTACHMENT_MAX_BYTES } from '@/app/utils/uploadTransactionAttachments';
import { prepareAttachmentFilesForUpload } from '@/app/utils/imageCompression';
import { useSupabase } from '@/app/context/SupabaseContext';
import { expenseCategoryService, type ExpenseCategoryTreeItem } from '@/app/services/expenseCategoryService';
import { getTailorOptionsForExtraType, tailorNameByCategoryId } from '@/app/utils/expenseCategoryTailors';
import { useCheckPermission } from '@/app/hooks/useCheckPermission';
import { useSettings } from '@/app/context/SettingsContext';
import { formatCurrency, getCurrencySymbol } from '@/app/utils/formatCurrency';
import { rankProductSearchHit, preferExactSkuHits, PRODUCT_SEARCH_RESULT_CAP } from '@/app/utils/productSearchRank';
import { contactService } from '@/app/services/contactService';
import { saleService } from '@/app/services/saleService';
import { productService } from '@/app/services/productService';
import { inventoryService } from '@/app/services/inventoryService';
import { branchService, Branch } from '@/app/services/branchService';
import { useSales, convertFromSupabaseSale, Sale } from '@/app/context/SalesContext';
import { coerceUuidOrNull } from '@/app/utils/uuidCoerce';
import { shouldShowSaleLineVariations } from '@/app/utils/saleLineVariation';
import { UnifiedSalesInvoiceView } from '@/app/documents';
import { useNavigation } from '@/app/context/NavigationContext';
import { Loader2 } from 'lucide-react';
import { useDocumentNumbering } from '@/app/hooks/useDocumentNumbering';
import { documentNumberService } from '@/app/services/documentNumberService';
import { isPreFinalSaleDocumentNo } from '@/app/lib/documentDisplayNumbers';
import { shipmentService, mapShipmentRowsToUi, type ShipmentType } from '@/app/services/shipmentService';
import { courierService, type CourierRow } from '@/app/services/courierService';
import { ShipmentModal } from './ShipmentModal';
import { userService, User as UserType } from '@/app/services/userService';

// Variation options come from backend (product.variations) - no dummy data.
// Built in useMemo below from products loaded from productService.

interface SaleItem {
    id: number;
    productId: number | string;
    name: string;
    sku: string;
    price: number;
    /** Retail/wholesale base before bespoke customization charges. */
    baseUnitPrice?: number;
    qty: number;
    // Standard Variation Fields (from backend product_variations)
    size?: string;
    color?: string;
    variationId?: string; // Backend variation id - for ledger/reporting/stock
    // Standard Packing Fields (Wholesale)
    thaans?: number;
    meters?: number;
    packingDetails?: PackingDetails;
    customizationDetails?: CustomizationDetails;
    packing_quantity?: number; // Backend-ready: total_meters
    packing_unit?: string; // Backend-ready: 'meters' etc.
    unit?: string; // Short code (pcs, m, yd) – from DB on edit, from product on new
    // Stock and Purchase Info
    stock?: number;
    lastPurchasePrice?: number;
    lastSupplier?: string;
    unitAllowDecimal?: boolean; // From product's unit
    // UI State
    showVariations?: boolean; // Flag to show variation selector inline under this item
    selectedVariationId?: string; // Currently selected variation ID
    /** Set when user opens packing modal; cleared on save. Used to block submit if packing not saved. */
    packingTouched?: boolean;
    bespokeParentCartId?: number;
    bespokeRole?: 'fabric';
    isBespokeInjected?: boolean;
    /** DB parent line id when editing existing sale */
    dbLineId?: string;
    bespokeParentItemId?: string | null;
}

interface PartialPayment {
    id: string;
    method: 'cash' | 'bank' | 'Mobile Wallet';
    amount: number;
    reference?: string;
    notes?: string;
    attachments?: PaymentAttachment[];
    /** Existing order deposit — do not re-post on convert save */
    isExisting?: boolean;
}

interface ExtraExpense {
    id: string;
    type: 'stitching' | 'lining' | 'dying' | 'cargo' | 'other';
    amount: number;
    notes?: string;
    tailorExpenseCategoryId?: string;
    tailorContactId?: string;
}

interface SaleFormProps {
  sale?: any; // Sale data for edit mode
  /** When true (Convert to Final flow): on Save, create NEW final sale (new SL-), archive source row (no delete). */
  convertToFinal?: boolean;
  onClose: () => void;
}

const SALE_FORM_BOOTSTRAP_TTL_MS = 45_000;
const saleFormBootstrapCache = new Map<
  string,
  {
    ts: number;
    customers: any[];
    products: any[];
    defaultCustomerId: string | null;
  }
>();

function mergeOverviewStockIntoSaleProducts(
  productsList: Array<{ id: string | number; variations?: any[]; hasVariations?: boolean; stock?: number; [key: string]: unknown }>,
  overview: Awaited<ReturnType<typeof inventoryService.getInventoryOverview>>,
) {
  const overviewByProductId: Record<
    string,
    { stock: number; hasVariations?: boolean; variations?: Array<{ id: string; stock: number }> }
  > = {};
  overview.forEach((row) => {
    const key = String(row.id ?? row.productId);
    overviewByProductId[key] = {
      stock: row.stock ?? 0,
      hasVariations: row.hasVariations,
      variations: row.variations?.map((v) => ({ id: v.id, stock: v.stock ?? 0 })),
    };
  });
  return productsList.map((p) => {
    const row = overviewByProductId[String(p.id)];
    if (!row) return p;
    if (row.hasVariations && row.variations?.length) {
      return {
        ...p,
        stock: row.stock,
        variations: (p.variations || []).map((v: { id: string; stock?: number }) => {
          const vStock = row.variations?.find((vv) => String(vv.id) === String(v.id));
          return { ...v, stock: vStock?.stock ?? v.stock ?? 0 };
        }),
      };
    }
    return { ...p, stock: row.stock };
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function savedBranchFromSale(sale: Sale | undefined): string {
  if (!sale) return '';
  const loc = (sale as { location?: string; branchId?: string }).location
    ?? (sale as { branchId?: string }).branchId;
  const s = loc != null ? String(loc).trim() : '';
  return s && s !== 'all' && UUID_RE.test(s) ? s : '';
}

function savedSalesmanFromSale(sale: Sale | undefined): string {
  if (!sale) return '1';
  const sid = (sale as { salesmanId?: string | null }).salesmanId;
  if (!sid || sid === 'none' || sid === '1') return 'none';
  return String(sid);
}

export const SaleForm = ({ sale: initialSale, convertToFinal, onClose }: SaleFormProps) => {
    useEffect(() => {
        if (!initialSale?.id || !convertToFinal) return;
        const st = String((initialSale as { status?: string }).status || '').toLowerCase();
        if (st === 'cancelled') {
            toast.error('Cannot convert a cancelled sale to final. Restore it from the sales list first.');
            onClose();
        }
    }, [initialSale?.id, (initialSale as { status?: string })?.status, convertToFinal, onClose]);

    // Supabase & Context
    const { companyId, branchId: contextBranchId, user, userRole, accessibleBranchIds, requiresBranchSelection } = useSupabase();
    const { canManageSettings } = useCheckPermission();
    const { inventorySettings, businessSettings, loading: settingsLoading, company, modules: settingsModules } = useSettings();
    const studioModuleEnabled = settingsModules.studioModuleEnabled;
    const enablePacking = inventorySettings.enablePacking;
    const enableBespoke = businessSettings.enableBespokeOrders;
    const bespokeFormConfig = businessSettings.bespokeFormConfig;
    const { createSale, updateSale, deleteSale, refreshSales } = useSales();
    const {
        openDrawer,
        closeDrawer,
        activeDrawer,
        createdContactId,
        createdContactType,
        setCreatedContactId,
        createdProduct,
        setCreatedProduct,
        openPackingModal,
        setCurrentView,
        setSelectedStudioSaleId,
        saleDrawerBespokeMode,
        clearSaleDrawerBespokeMode,
    } = useNavigation();

    useEffect(() => {
        if (!saleDrawerBespokeMode || initialSale || !enableBespoke) return;
        setSaleStatus('order');
        toast.info('Custom order mode — status set to Order. Add products and customize each line.');
        clearSaleDrawerBespokeMode();
    }, [saleDrawerBespokeMode, initialSale, enableBespoke, clearSaleDrawerBespokeMode]);

    // Permission-based: settings access allows branch selection and full branch list (was role === 'admin')
    const isAdmin = canManageSettings;
    const canAssignCommission = canAssignSaleCommission(userRole);
    const [erpUserId, setErpUserId] = useState<string | null>(null);

    useEffect(() => {
        if (!user?.id || !companyId) {
            setErpUserId(null);
            return;
        }
        let cancelled = false;
        void (async () => {
            try {
                const { supabase } = await import('@/lib/supabase');
                const { data: byAuth } = await supabase
                    .from('users')
                    .select('id')
                    .eq('auth_user_id', user.id)
                    .maybeSingle();
                if (cancelled) return;
                if (byAuth?.id) {
                    setErpUserId(String(byAuth.id));
                    return;
                }
                const { data: byId } = await supabase.from('users').select('id').eq('id', user.id).maybeSingle();
                if (!cancelled && byId?.id) setErpUserId(String(byId.id));
            } catch {
                if (!cancelled) setErpUserId(null);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [user?.id, companyId]);
    
    // Data State
    const [customers, setCustomers] = useState<Array<{ id: number | string; name: string; dueBalance: number }>>([]);
    const [products, setProducts] = useState<Array<{ id: number | string; name: string; sku: string; price: number; stock: number; lastPurchasePrice?: number; lastSupplier?: string; hasVariations: boolean; needsPacking: boolean; variations?: Array<{ id: string; attributes?: Record<string, unknown>; size?: string; color?: string }> }>>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // Salesmen - Load from userService (default_commission_percent used when salesman selected for new sale)
    const [salesmen, setSalesmen] = useState<Array<{ id: string; name: string; code?: string; defaultCommissionPercent?: number | null }>>([
        { id: 'none', name: "No Salesman" }
    ]);
    
    // Header State
    const [customerId, setCustomerId] = useState("");
    const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
    const [customerSearchTerm, setCustomerSearchTerm] = useState("");
    /** Keyboard highlight index in customer dropdown (-1 = none). */
    const [customerSearchHighlightIndex, setCustomerSearchHighlightIndex] = useState(-1);
    const [pendingCustomerId, setPendingCustomerId] = useState<string | null>(null);
    const dataLoadedRef = useRef(false); // Track if initial data load has completed
    const stockBranchRef = useRef<string | null>(null);
    const itemsHydratedRef = useRef(!convertToFinal || !initialSale?.id);
    const paymentsHydratedRef = useRef(!convertToFinal || !initialSale?.id);
    const extraExpensesHydratedRef = useRef(!convertToFinal || !initialSale?.id);
    const [extraExpensesHydrated, setExtraExpensesHydrated] = useState(!convertToFinal || !initialSale?.id);
    const [convertHydrationReady, setConvertHydrationReady] = useState(
        !convertToFinal || !initialSale?.id,
    );

    useEffect(() => {
        const ready = !convertToFinal || !initialSale?.id;
        itemsHydratedRef.current = ready;
        paymentsHydratedRef.current = ready;
        extraExpensesHydratedRef.current = ready;
        setExtraExpensesHydrated(ready);
        setConvertHydrationReady(ready);
    }, [initialSale?.id, convertToFinal]);

    // Fresh bootstrap when opening a different sale or convert-to-final mode
    useEffect(() => {
        dataLoadedRef.current = false;
    }, [initialSale?.id, convertToFinal]);

    // Edit/convert: show form immediately; item hydration runs in parallel
    useEffect(() => {
        if (initialSale?.id) {
            setLoading(false);
        }
    }, [initialSale?.id]);
    const [saleDate, setSaleDate] = useState<Date>(new Date());
    const [refNumber, setRefNumber] = useState("");
    const [saleNotes, setSaleNotes] = useState(""); // Notes field for sale (saves to database)
    const [invoiceNumber, setInvoiceNumber] = useState("");
    
    // Branch State - Locked for regular users, open for admin
    const [branchId, setBranchId] = useState<string>(() => {
      const saved = savedBranchFromSale(initialSale);
      if (saved) return saved;
      const ctx = contextBranchId || '';
      return ctx && ctx !== 'all' ? ctx : '';
    });
    const [branches, setBranches] = useState<Branch[]>([]);

    // Legacy picker used synthetic id "walk-in"; resolve to real `contacts` row (matches Contacts page)
    useEffect(() => {
        if (!companyId || customerId !== 'walk-in') return;
        let cancelled = false;
        (async () => {
            const w = await contactService.getWalkingCustomer(companyId);
            if (!cancelled && w?.id) setCustomerId(String(w.id));
        })();
        return () => {
            cancelled = true;
        };
    }, [companyId, customerId]);

    const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
    const [salesmanDropdownOpen, setSalesmanDropdownOpen] = useState(false);
    const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
    const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
    
    // Items List State
    const [items, setItems] = useState<SaleItem[]>([]);
    
    // --- New Entry Row State (The "Stage") ---
    const [productSearchOpen, setProductSearchOpen] = useState(false);
    const [productSearchTerm, setProductSearchTerm] = useState("");
    const [pendingProduct, setPendingProduct] = useState<any | null>(null);
    const [pendingQty, setPendingQty] = useState<number>(1);
    const [pendingPrice, setPendingPrice] = useState<number>(0);
    // Standard Variation States
    const [pendingSize, setPendingSize] = useState<string>("");
    const [pendingColor, setPendingColor] = useState<string>("");
    // Inline Variation Selection
    const [showVariationSelector, setShowVariationSelector] = useState(false);
    const [selectedProductForVariation, setSelectedProductForVariation] = useState<any | null>(null);
    // Standard Packing States
    const [pendingThaans, setPendingThaans] = useState<number>(0);
    const [pendingMeters, setPendingMeters] = useState<number>(0);
    const [pendingPackingDetails, setPendingPackingDetails] = useState<PackingDetails | undefined>(undefined);
    
    // Focus Refs
    const searchInputRef = useRef<HTMLInputElement>(null);
    const customerPopoverSearchRef = useRef<HTMLInputElement>(null);
    const qtyInputRef = useRef<HTMLInputElement>(null);
    const priceInputRef = useRef<HTMLInputElement>(null);
    const addBtnRef = useRef<HTMLButtonElement>(null);
    
    // Keyboard navigation state - tracks last added item for auto-focus
    const [lastAddedItemId, setLastAddedItemId] = useState<number | null>(null);
    
    // Refs for item inputs (keyed by item ID)
    const itemQtyRefs = useRef<Record<number, HTMLInputElement | null>>({});
    const itemPriceRefs = useRef<Record<number, HTMLInputElement | null>>({});
    const itemVariationRefs = useRef<Record<number, HTMLButtonElement | null>>({});

    // Payment State
    const [partialPayments, setPartialPayments] = useState<PartialPayment[]>([]);
    const [paymentsLoading, setPaymentsLoading] = useState(false);
    
    // Payment Form State
    const [newPaymentMethod, setNewPaymentMethod] = useState<'cash' | 'bank' | 'Mobile Wallet'>('cash');
    const [newPaymentAmount, setNewPaymentAmount] = useState<number>(0);
    
    // Payment Dialog State
    const [paymentChoiceDialogOpen, setPaymentChoiceDialogOpen] = useState(false);
    const [pendingSaveAction, setPendingSaveAction] = useState<{ print: boolean } | null>(null);
    const [unifiedPaymentDialogOpen, setUnifiedPaymentDialogOpen] = useState(false);
    const [savedSaleId, setSavedSaleId] = useState<string | null>(null);
    const [savedSaleInvoiceNo, setSavedSaleInvoiceNo] = useState<string | null>(null);
    const [newPaymentReference, setNewPaymentReference] = useState<string>("");
    
    // Payment Attachments State
    const [paymentAttachments, setPaymentAttachments] = useState<PaymentAttachment[]>([]);
    const [saleAttachmentFiles, setSaleAttachmentFiles] = useState<File[]>([]);
    const [isProcessingSaleAttachments, setIsProcessingSaleAttachments] = useState(false);
    const saleAttachmentInputRef = useRef<HTMLInputElement>(null);
    const [savedSaleAttachments, setSavedSaleAttachments] = useState<{ url: string; name: string }[]>([]);

    // Print layout after Save & Print
    const [showPrintLayout, setShowPrintLayout] = useState(false);
    const [saleForPrint, setSaleForPrint] = useState<Sale | null>(null);

    // Extra Expenses State
    const [extraExpenses, setExtraExpenses] = useState<ExtraExpense[]>([]);
    /** 4120 package split: when false, extras are inclusive (not on customer total). */
    const [chargeExtrasToCustomer, setChargeExtrasToCustomer] = useState(true);
    const [newExpenseType, setNewExpenseType] = useState<'stitching' | 'lining' | 'dying' | 'cargo' | 'other'>('stitching');
    const [newExpenseAmount, setNewExpenseAmount] = useState<number>(0);
    const [newExpenseNotes, setNewExpenseNotes] = useState<string>("");
    const [newTailorCategoryId, setNewTailorCategoryId] = useState<string>("");
    const [expenseCategoryTree, setExpenseCategoryTree] = useState<ExpenseCategoryTreeItem[]>([]);

    useEffect(() => {
        if (!companyId) return;
        expenseCategoryService.getTree(companyId).then(setExpenseCategoryTree).catch(() => setExpenseCategoryTree([]));
    }, [companyId]);

    const tailorOptionsForNewExpense = useMemo(
        () => getTailorOptionsForExtraType(expenseCategoryTree, newExpenseType),
        [expenseCategoryTree, newExpenseType],
    );

    // Discount State
    const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
    const [discountValue, setDiscountValue] = useState<number>(0);

    // Salesman State (moved to header) - TASK 4 FIX
    // For normal users: auto-assign to logged-in user
    // For admin: allow selection
    const [salesmanId, setSalesmanId] = useState<string>(() => {
      if (initialSale?.id) return savedSalesmanFromSale(initialSale);
      return '1';
    });
    const [commissionType, setCommissionType] = useState<'percentage' | 'fixed'>('percentage');
    const [commissionValue, setCommissionValue] = useState<number>(0);
    
    // Auto-assign salesman for workers: match public.users.id (erp profile), then name fallback
    useEffect(() => {
      if (canAssignCommission || initialSale?.id) return;
      if (salesmanId !== "1" && salesmanId !== "none") return;
      const byProfile = erpUserId ? salesmen.find((s) => s.id === erpUserId) : undefined;
      const byName =
        !byProfile &&
        user &&
        salesmen.find(
          (s) =>
            s.name === (user as { email?: string }).email ||
            s.name === ((user as { user_metadata?: { full_name?: string; name?: string } }).user_metadata?.full_name || '') ||
            s.name === ((user as { user_metadata?: { full_name?: string; name?: string } }).user_metadata?.name || ''),
        );
      const match = byProfile || byName;
      if (match) setSalesmanId(match.id.toString());
    }, [canAssignCommission, initialSale?.id, erpUserId, user, salesmanId, salesmen]);

    // When a salesman is selected on a NEW sale, auto-fill commission from their default % (admin can override per invoice)
    // On edit we do not overwrite: saved commission stays until user changes it
    useEffect(() => {
      if (initialSale?.id || !salesmanId || salesmanId === '1' || salesmanId === 'none') return;
      const sm = salesmen.find(s => s.id === salesmanId);
      const pct = sm?.defaultCommissionPercent;
      // Include 0 so default 0% shows clearly in the field
      if (pct != null) {
        setCommissionType('percentage');
        setCommissionValue(Number(pct));
      }
    }, [salesmanId, salesmen, initialSale?.id]);

    // Shipping Charge – amount charged to customer (saved in sale_shipments.charged_to_customer when shipment exists)
    const [shippingChargeInput, setShippingChargeInput] = useState<number>(0);

    // Shipment (sale_shipments) – when editing a sale, load from API
    const [saleShipments, setSaleShipments] = useState<Array<{ id: string; shipmentType: ShipmentType; courierMasterId?: string; courierName?: string; shipmentStatus: string; trackingId?: string; weight?: number; chargedToCustomer: number; actualCost: number; notes?: string }>>([]);
    const [couriers, setCouriers] = useState<CourierRow[]>([]);
    const [showShipmentModal, setShowShipmentModal] = useState(false);
    const [editingShipmentId, setEditingShipmentId] = useState<string | null>(null);

    // Studio Sale State
    const [isStudioSale, setIsStudioSale] = useState<boolean>(false);

    useEffect(() => {
        if (!studioModuleEnabled && !initialSale?.id) {
            setIsStudioSale(false);
        }
    }, [studioModuleEnabled, initialSale?.id]);
    /** Persisted to studio_productions.design_name (required for studio sales). */
    const [studioProductName, setStudioProductName] = useState<string>("");
    const [studioNotes, setStudioNotes] = useState<string>("");

    // Status State (Draft, Quotation, Final, etc.)
    const [saleStatus, setSaleStatus] = useState<'draft' | 'quotation' | 'order' | 'final'>('draft');
    const [studioDeadline, setStudioDeadline] = useState<Date | undefined>(undefined);
    const studioDeadlineRef = useRef<Date | undefined>(undefined);

    // Packing Modal State - Now using global modal via NavigationContext
    const [activePackingItemId, setActivePackingItemId] = useState<number | null>(null);
    const [bespokeItemId, setBespokeItemId] = useState<number | null>(null);

    // Document numbering (must be before displayInvoiceNumber useMemo)
    const { generateDocumentNumber, incrementNextNumber } = useDocumentNumbering();

    const initialOrderStatus =
        String((initialSale as { status?: string })?.status || '').toLowerCase() === 'order';
    const isOrderToFinal =
        convertToFinal ||
        (Boolean(initialSale?.id) && initialOrderStatus && saleStatus === 'final');
    const needsConvertHydration = isOrderToFinal;

    useEffect(() => {
        if (!needsConvertHydration || !initialSale?.id) return;
        if (itemsHydratedRef.current && paymentsHydratedRef.current && extraExpensesHydratedRef.current) {
            setConvertHydrationReady(true);
        } else {
            setConvertHydrationReady(false);
        }
    }, [needsConvertHydration, initialSale?.id, saleStatus, extraExpensesHydrated]);

    useEffect(() => {
        if (!needsConvertHydration || !initialSale?.id || convertHydrationReady) return;
        const timer = window.setTimeout(() => {
            if (!itemsHydratedRef.current || !paymentsHydratedRef.current || !extraExpensesHydratedRef.current) {
                toast.warning(
                    'Order data took longer than expected. Verify line totals, extra charges, and deposit before saving.',
                );
            }
            itemsHydratedRef.current = true;
            paymentsHydratedRef.current = true;
            extraExpensesHydratedRef.current = true;
            setExtraExpensesHydrated(true);
            setConvertHydrationReady(true);
        }, 8000);
        return () => window.clearTimeout(timer);
    }, [needsConvertHydration, initialSale?.id, convertHydrationReady]);

    const getSaleItemBasePrice = (item: SaleItem): number => {
        if (item.baseUnitPrice != null && Number.isFinite(item.baseUnitPrice)) {
            return item.baseUnitPrice;
        }
        return deriveBaseUnitPriceFromStored(item.price, item.customizationDetails);
    };

    const getSaleItemUnitPrice = (item: SaleItem): number =>
        resolveSaleLineUnitPrice({
            price: item.price,
            baseUnitPrice: item.baseUnitPrice,
            customizationDetails: item.customizationDetails,
        });

    // Calculations
    const subtotal = items.reduce((sum, item) => sum + getSaleItemUnitPrice(item) * item.qty, 0);
    const expensesTotal = extraExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const expensesOnBill = chargeExtrasToCustomer ? expensesTotal : 0;
    
    // Calculate discount amount
    const discountAmount = discountType === 'percentage' 
        ? (subtotal * discountValue) / 100 
        : discountValue;
    
    // Shipment charges from sale_shipments (when editing existing sale with shipment(s))
    const shipmentChargesFromApi = saleShipments.reduce((s, x) => s + x.chargedToCustomer, 0);
    // Document state: Order or Final enables shipping/shipment/attachments/extra expenses
    const isFinal = saleStatus === 'final';
    const saleExtrasActive = saleStatus === 'final' || saleStatus === 'order';
    const saleExtrasPanelLocked = !saleExtrasActive;

    // PART 2: grand_total = items + (extras if on bill) + shipping - discount
    const afterDiscountTotal = subtotal - discountAmount + expensesOnBill;
    const effectiveShippingCharges = initialSale?.id ? shipmentChargesFromApi : (shippingChargeInput || 0);
    const totalAmount = afterDiscountTotal + effectiveShippingCharges;
    
    // Calculate salesman commission
    const commissionAmount = commissionType === 'percentage'
        ? (subtotal * commissionValue) / 100
        : commissionValue;
    
    // Automatic Payment Status Detection
    const totalPaid = partialPayments.reduce((sum, p) => sum + p.amount, 0);
    const balanceDue = totalAmount - totalPaid;
    
    // Auto-detect payment status
    // CRITICAL FIX: Use 'unpaid' instead of 'credit' to match database enum (paid, partial, unpaid)
    const paymentStatus = totalPaid === 0 ? 'unpaid' : totalPaid >= totalAmount ? 'paid' : 'partial';

    const getSalesmanName = () => salesmen.find(s => s.id.toString() === salesmanId)?.name || "No Salesman";

    // Enhanced search with shared SKU/name ranker (narrow numeric matches)
    const filteredProducts = useMemo(() => {
        if (!productSearchTerm.trim()) return products;

        const searchTerm = productSearchTerm.trim();
        let results = products.filter((p) => rankProductSearchHit(p, searchTerm) < 99);

        results.sort((a, b) => {
            const ra = rankProductSearchHit(a, searchTerm);
            const rb = rankProductSearchHit(b, searchTerm);
            if (ra !== rb) return ra - rb;
            return String(a.name).localeCompare(String(b.name));
        });

        results = preferExactSkuHits(results, searchTerm);
        if (results.length > PRODUCT_SEARCH_RESULT_CAP) {
            results = results.slice(0, PRODUCT_SEARCH_RESULT_CAP);
        }
        return results;
    }, [products, productSearchTerm]);
    
    // Variation options from backend only (product.variations) - no dummy data
    // Variation options from backend - for inline selection
    const productVariationsFromBackend = useMemo(() => {
        const map: Record<string | number, Array<{ id?: string; size?: string; color?: string; sku?: string; price?: number; stock?: number; attributes?: Record<string, unknown> }>> = {};
        products.forEach((p) => {
            if (!p.variations?.length) return;
            const productId = p.id;
            const stringKey = String(productId);
            const numKey = typeof productId === 'number' ? productId : (/^\d+$/.test(stringKey) ? parseInt(stringKey, 10) : null);
            
            // Normalize variations to ensure consistent structure
            const normalizedVariations = p.variations.map((v: any) => {
                // Extract size and color from various possible structures
                let size = v.size || '';
                let color = v.color || '';
                
                // If not found directly, check attributes object
                if (!size && v.attributes) {
                    size = v.attributes.size || 
                           v.attributes.Size || 
                           v.attributes.SIZE || 
                           (typeof v.attributes === 'object' ? Object.values(v.attributes).find((val: any) => typeof val === 'string' && ['s', 'm', 'l', 'xl', 'xs'].includes(val.toLowerCase())) : '') || 
                           '';
                }
                
                if (!color && v.attributes) {
                    color = v.attributes.color || 
                            v.attributes.Color || 
                            v.attributes.COLOR || 
                            (typeof v.attributes === 'object' ? Object.values(v.attributes).find((val: any) => typeof val === 'string' && ['red', 'blue', 'green', 'white', 'black'].some(c => val.toLowerCase().includes(c))) : '') || 
                            '';
                }
                
                return {
                    id: v.id,
                    size: String(size || '').trim(),
                    color: String(color || '').trim(),
                    sku: v.sku,
                    price: v.price,
                    stock: v.stock,
                    attributes: v.attributes || {},
                };
            });
            
            map[stringKey] = normalizedVariations;
            if (numKey !== null) {
                map[numKey] = normalizedVariations;
            }
        });
        return map;
    }, [products]);

    // Reconcile variation selector visibility once product catalog (with variations) is loaded
    useEffect(() => {
        if (!items.length || !Object.keys(productVariationsFromBackend).length) return;
        setItems((prev) => {
            let changed = false;
            const next = prev.map((item) => {
                const variations =
                    productVariationsFromBackend[item.productId] ??
                    productVariationsFromBackend[String(item.productId)] ??
                    productVariationsFromBackend[Number(item.productId)] ??
                    [];
                const show = shouldShowSaleLineVariations(undefined, variations);
                if (item.showVariations === show) return item;
                changed = true;
                return { ...item, showVariations: show };
            });
            return changed ? next : prev;
        });
    }, [productVariationsFromBackend, items.length]);
    
    // Load data from Supabase
    // CRITICAL: Only load on initial mount, not on every companyId change
    // This prevents remount/reload from resetting customer selection
    useEffect(() => {
        const loadData = async () => {
            if (!companyId) {
                setLoading(false);
                return;
            }

            const finishBootstrapLoading = () => setLoading(false);

            // CRITICAL: Don't reload if data has already been loaded (prevents state reset)
            if (dataLoadedRef.current) {
                if (import.meta.env?.DEV) {
                    console.log('[SALE FORM] Skipping loadData - data already loaded (prevents state reset)');
                }
                finishBootstrapLoading();
                return;
            }
            const branchForBalances =
                branchId && branchId !== 'all'
                    ? branchId
                    : contextBranchId && contextBranchId !== 'all'
                      ? contextBranchId
                      : null;
            const cacheKey = `${companyId}:${branchForBalances ?? 'all'}`;
            const cached = saleFormBootstrapCache.get(cacheKey);
            const isEditOrConvert = Boolean(initialSale?.id);
            if (cached && Date.now() - cached.ts < SALE_FORM_BOOTSTRAP_TTL_MS) {
                setCustomers(cached.customers);
                setProducts(cached.products);
                if (!customerId && !initialSale && cached.defaultCustomerId) {
                    setCustomerId(cached.defaultCustomerId);
                }
                dataLoadedRef.current = true;
                if (import.meta.env?.DEV) console.log('[SALE FORM] Reused bootstrap cache');
                stockBranchRef.current = branchForBalances ?? 'all';
                finishBootstrapLoading();
                return;
            }
            
            try {
                setLoading(true);

                await contactService.ensureDefaultWalkingCustomerForCompany(companyId);

                // Load customers + operational AR per contact (RPC; not raw SUM(sales.due_amount))
                const [contactsData, balanceSummary] = await Promise.all([
                    contactService.getAllContacts(companyId),
                    contactService.getContactBalancesSummary(companyId, branchForBalances),
                ]);
                const { map: receivableMap, error: balanceErr } = balanceSummary;
                if (balanceErr && import.meta.env?.DEV) {
                    console.warn('[SALE FORM] getContactBalancesSummary:', balanceErr);
                }
                const customerContacts = (contactsData || [])
                    .filter((c: any) => c.type === 'customer' || c.type === 'both')
                    .map((c: any) => {
                        const cId = c.id || c.uuid || '';
                        const dueBalance = receivableMap.get(String(cId))?.receivables ?? 0;
                        return {
                            id: cId,
                            name: c.name || '',
                            dueBalance
                        };
                    });
                
                // Default walk-in exists as a real `contacts` row (same as Contacts page) — no synthetic duplicate row
                let defaultCustomerRow: Awaited<ReturnType<typeof contactService.getDefaultCustomer>> = null;
                try {
                    defaultCustomerRow = await contactService.getDefaultCustomer(companyId);
                } catch (error) {
                    console.warn('[SALE FORM] Could not fetch default customer:', error);
                }
                if (!defaultCustomerRow) {
                    try {
                        defaultCustomerRow = await contactService.getWalkingCustomer(companyId);
                    } catch (_) {}
                }
                const defaultCustomerId = defaultCustomerRow?.id ? String(defaultCustomerRow.id) : null;

                let customerList = [...customerContacts];
                if (
                    defaultCustomerId &&
                    !customerList.some((c) => String(c.id) === defaultCustomerId) &&
                    defaultCustomerRow
                ) {
                    customerList = [
                        {
                            id: defaultCustomerId,
                            name: defaultCustomerRow.name || 'Walk-in Customer',
                            dueBalance: receivableMap.get(defaultCustomerId)?.receivables ?? 0,
                        },
                        ...customerList,
                    ];
                }

                setCustomers(customerList);

                // Auto-select default customer for new sale
                if (!customerId && !initialSale) {
                    if (defaultCustomerId) {
                        console.log('[SALE FORM] Auto-selecting default customer:', defaultCustomerId);
                        setCustomerId(defaultCustomerId);
                    } else {
                        console.log('[SALE FORM] No default walking customer — leave selection empty');
                    }
                }
                
                // Load products (+ stock overview for new sales only; edit/convert skips slow inventory pass)
                const branchForStock =
                  !isEditOrConvert && branchForBalances && branchForBalances !== 'all'
                    ? branchForBalances
                    : undefined;
                const { unitService } = await import('@/app/services/unitService');
                let productsData: Awaited<ReturnType<typeof productService.getAllProducts>>;
                let unitsData: Awaited<ReturnType<typeof unitService.getAll>>;
                let overview: Awaited<ReturnType<typeof inventoryService.getInventoryOverview>> = [];

                if (isEditOrConvert) {
                    [productsData, unitsData] = await Promise.all([
                      productService.getAllProducts(companyId),
                      unitService.getAll(companyId),
                    ]);
                } else {
                    [productsData, unitsData, overview] = await Promise.all([
                      productService.getAllProducts(companyId),
                      unitService.getAll(companyId),
                      inventoryService.getInventoryOverview(companyId, branchForStock),
                    ]);
                }
                const unitsMap = new Map(unitsData.map((u) => [u.id, u]));

                const productsListBase = productsData.map((p) => {
                  const unit = p.unit_id ? unitsMap.get(p.unit_id) : null;
                  return {
                    id: p.id || p.uuid || '',
                    name: p.name || '',
                    sku: p.sku || '',
                    price: (p.retail_price ?? p.sellingPrice ?? p.salePrice ?? p.price) || 0,
                    stock: 0,
                    lastPurchasePrice: (p.cost_price ?? p.costPrice) ?? undefined,
                    lastSupplier: undefined,
                    hasVariations: (p.variations && p.variations.length > 0) || false,
                    needsPacking: false,
                    variations: p.variations || [],
                    unitAllowDecimal: unit?.allow_decimal ?? false,
                  };
                });
                const productsList = isEditOrConvert
                  ? productsListBase
                  : mergeOverviewStockIntoSaleProducts(productsListBase, overview);
                
                setProducts(productsList);
                stockBranchRef.current = branchForBalances ?? 'all';
                saleFormBootstrapCache.set(cacheKey, {
                    ts: Date.now(),
                    customers: customerList,
                    products: productsList,
                    defaultCustomerId,
                });
                
                // Mark data as loaded to prevent future reloads
                dataLoadedRef.current = true;
                console.log('[SALE FORM] Initial data load completed');
            } catch (error) {
                console.error('[SALE FORM] Error loading data:', error);
                toast.error('Failed to load data');
            } finally {
                setLoading(false);
            }
        };
        
        loadData();
    }, [companyId]); // Only run on companyId change, but skip if data already loaded

    // Accessible branches: for admin = all company branches; for others = branches user has access to
    const accessibleBranches = React.useMemo(() => {
        if (!branches.length) return [];
        if (isAdmin) return branches;
        const idSet = new Set(accessibleBranchIds.map((id: string) => String(id)));
        return branches.filter((b: Branch) => idSet.has(String(b.id)));
    }, [branches, accessibleBranchIds, isAdmin]);

    const showBranchSelector = accessibleBranches.length > 1;
    const singleBranchAutoSelected = accessibleBranches.length === 1;

    // Load branches
    const [branchesError, setBranchesError] = useState<unknown>(null);
    useEffect(() => {
        const loadBranches = async () => {
            if (!companyId) return;
            try {
                setBranchesError(null);
                const branchesData = await branchService.getAllBranches(companyId);
                setBranches(branchesData);
            } catch (error) {
                console.error('[SALE FORM] Error loading branches:', error);
                setBranchesError(error);
            }
        };
        loadBranches();
    }, [companyId]);

    // STEP 0 — Debug log (branch/salesman diagnostics)
    useEffect(() => {
        if (!companyId || !import.meta.env?.DEV) return;
        console.log('[SALE FORM BRANCH DEBUG]', {
            role: userRole,
            uid: user?.id,
            companyId,
            profileBranchId: contextBranchId,
            branchesCount: branches?.length ?? 0,
            accessibleBranchesCount: accessibleBranches?.length ?? 0,
            accessibleBranchIdsLength: accessibleBranchIds?.length ?? 0,
            branchesError: branchesError ? String(branchesError) : null,
        });
    }, [companyId, userRole, user?.id, contextBranchId, branches?.length, accessibleBranches?.length, accessibleBranchIds?.length, branchesError]);

    // Smart branch auto-selection: when only one accessible branch, set it; sync from context when needed
    useEffect(() => {
        if (!branches.length) return;
        const ids = isAdmin ? branches.map((b: Branch) => String(b.id)) : accessibleBranchIds.map((id: string) => String(id));
        const filtered = branches.filter((b: Branch) => ids.includes(String(b.id)));
        const savedEditBranch = initialSale?.id ? savedBranchFromSale(initialSale) : '';
        setBranchId((prev) => {
            if (initialSale?.id && savedEditBranch && ids.includes(String(savedEditBranch))) {
                return savedEditBranch;
            }
            if (initialSale?.id && prev && prev !== 'all' && UUID_RE.test(String(prev)) && ids.includes(String(prev))) {
                return prev;
            }
            if (initialSale?.id) {
                return prev;
            }
            if (filtered.length === 1) return filtered[0].id;
            if (contextBranchId && contextBranchId !== 'all' && ids.includes(String(contextBranchId))) return contextBranchId;
            if (!prev || prev === 'all') {
                const main = branches.find((b: Branch) => (b as any).is_default === true) || filtered[0];
                return main ? main.id : prev;
            }
            if (ids.length && !ids.includes(String(prev))) return ids[0]; // current selection not in accessible, pick first
            return prev;
        });
    }, [branches, accessibleBranchIds, isAdmin, contextBranchId, initialSale?.id]);

    // Refresh product stock when branch changes (after initial bootstrap)
    useEffect(() => {
        if (!companyId || !dataLoadedRef.current || !products.length) return;
        const rawBranch = branchId || contextBranchId;
        const branchToUse = rawBranch && rawBranch !== 'all' ? rawBranch : null;
        const branchKey = branchToUse ?? 'all';
        if (stockBranchRef.current === branchKey) return;
        stockBranchRef.current = branchKey;
        let cancelled = false;
        (async () => {
            try {
                const overview = await inventoryService.getInventoryOverview(
                  companyId,
                  branchToUse || undefined,
                );
                if (cancelled || !overview?.length) return;
                setProducts((prev) => mergeOverviewStockIntoSaleProducts(prev, overview));
            } catch {
                /* keep existing stock on error */
            }
        })();
        return () => { cancelled = true; };
    }, [companyId, branchId, contextBranchId]);

    // Load salesmen from userService
    useEffect(() => {
        const loadSalesmen = async () => {
            if (!companyId) return;
            
            try {
                const users = await userService.getSalesmen(companyId);
                const salesmenList = [
                    { id: 'none', name: "No Salesman", code: '' },
                    ...users.map((user: UserType) => ({
                        id: user.id,
                        name: user.full_name || user.email,
                        code: user.user_code || '',
                        defaultCommissionPercent: user.default_commission_percent != null ? Number(user.default_commission_percent) : null
                    }))
                ];
                setSalesmen(salesmenList);
            } catch (error) {
                console.error('[SALE FORM] Error loading salesmen:', error);
                // Keep default "No Salesman" option on error
            }
        };
        
        loadSalesmen();
    }, [companyId]);

    // Reload customers when contact is created (IMMEDIATELY, not waiting for drawer to close)
    useEffect(() => {
        const reloadCustomers = async () => {
            // Reload when:
            // 1. A contact was created (createdContactId is not null)
            // 2. AND the contact type is relevant (customer or both)
            // 3. AND we have companyId
            // This triggers IMMEDIATELY when customer is created, without waiting for drawer to close
            if (companyId && createdContactId !== null && 
                (createdContactType === 'customer' || createdContactType === 'both')) {
                try {
                    // Store the contact ID before clearing (for auto-selection)
                    const contactIdToSelect = createdContactId;
                    const contactTypeToSelect = createdContactType;
                    
                    // Clear immediately to prevent duplicate reloads
                    if (setCreatedContactId) {
                        setCreatedContactId(null, null);
                    }
                    
                    // CRITICAL: Reload IMMEDIATELY when drawer closes
                    console.log('[SALE FORM] Reloading customers IMMEDIATELY, createdContactId:', contactIdToSelect, 'Type:', contactTypeToSelect);
                    
                    // Small delay to ensure DB commit (reduced since we're not waiting for drawer close)
                    await new Promise(resolve => setTimeout(resolve, 300));
                    
                    const branchForBalances =
                        branchId && branchId !== 'all'
                            ? branchId
                            : contextBranchId && contextBranchId !== 'all'
                              ? contextBranchId
                              : null;
                    const [contactsDataReload, balanceReload] = await Promise.all([
                        contactService.getAllContacts(companyId),
                        contactService.getContactBalancesSummary(companyId, branchForBalances),
                    ]);
                    const { map: receivableMapReload, error: balanceReloadErr } = balanceReload;
                    if (balanceReloadErr && import.meta.env?.DEV) {
                        console.warn('[SALE FORM] getContactBalancesSummary (reload):', balanceReloadErr);
                    }
                    const customerContacts = (contactsDataReload || [])
                        .filter((c: any) => c.type === 'customer' || c.type === 'both')
                        .map((c: any) => {
                            const cId = c.id || c.uuid || '';
                            const dueBalance = receivableMapReload.get(String(cId))?.receivables ?? 0;
                            return { id: cId, name: c.name || '', dueBalance };
                        });
                    
                    console.log('[SALE FORM] Reloaded customers:', customerContacts.length, 'IDs:', customerContacts.map(c => c.id));
                    
                    const updatedCustomers = [...customerContacts];
                    
                    // Auto-select newly created contact
                    const contactIdStr = contactIdToSelect.toString();
                    const foundContact = customerContacts.find(c => {
                        const cId = c.id?.toString() || '';
                        // Exact match first
                        if (cId === contactIdStr || c.id === contactIdToSelect) {
                            return true;
                        }
                        // UUID format matching (handle with/without dashes)
                        const normalizedCId = cId.replace(/-/g, '').toLowerCase();
                        const normalizedCreatedId = contactIdStr.replace(/-/g, '').toLowerCase();
                        if (normalizedCId === normalizedCreatedId) {
                            return true;
                        }
                        return false;
                    });
                    
                    if (foundContact) {
                        const selectedId = foundContact.id.toString();
                        
                        // CRITICAL: Update customers array first
                        setCustomers(updatedCustomers);
                        
                        // Store pending customer ID - separate useEffect will handle the selection
                        // This ensures customers array is fully updated before we try to select
                        setPendingCustomerId(selectedId);
                        console.log('[SALE FORM] Set pending customer ID:', selectedId, foundContact.name);
                    } else {
                        console.warn('[SALE FORM] ❌ Could not find created contact:', contactIdStr, 'Available IDs:', customerContacts.map(c => c.id));
                        // Try one more time after a longer delay (DB might need more time)
                        setTimeout(async () => {
                            const branchForBalancesRetry =
                                branchId && branchId !== 'all'
                                    ? branchId
                                    : contextBranchId && contextBranchId !== 'all'
                                      ? contextBranchId
                                      : null;
                            const [retryContactsData, retryBalance] = await Promise.all([
                                contactService.getAllContacts(companyId),
                                contactService.getContactBalancesSummary(companyId, branchForBalancesRetry),
                            ]);
                            const { map: retryRecvMap } = retryBalance;
                            const retryContacts = (retryContactsData || [])
                                .filter((c: any) => c.type === 'customer' || c.type === 'both')
                                .map((c: any) => {
                                    const cId = c.id || c.uuid || '';
                                    const dueBalance = retryRecvMap.get(String(cId))?.receivables ?? 0;
                                    return { id: cId, name: c.name || '', dueBalance };
                                });
                            const retryFound = retryContacts.find(c => {
                                const cId = c.id?.toString() || '';
                                return cId === contactIdStr || c.id === contactIdToSelect;
                            });
                            if (retryFound) {
                                setCustomers([...retryContacts]);
                                const retrySelectedId = retryFound.id.toString();
                                // Auto-select immediately
                                setCustomerId(retrySelectedId);
                                setCustomerSearchOpen(false);
                                setCustomerSearchTerm('');
                                toast.success(`Customer "${retryFound.name}" selected`);
                                console.log('[SALE FORM] ✅ Retry successful - Auto-selected customer');
                            }
                        }, 1000);
                    }
                } catch (error) {
                    console.error('[SALE FORM] Error reloading customers:', error);
                }
            } else if (createdContactId !== null && 
                       (createdContactType === 'supplier' || createdContactType === 'worker')) {
                // Clear the ID if supplier/worker was created (no reload needed)
                if (setCreatedContactId) {
                    setCreatedContactId(null, null);
                }
            }
        };
        
        reloadCustomers();
    }, [companyId, createdContactId, createdContactType, setCreatedContactId, branchId, contextBranchId]);

    // Recompute customer AR when sale branch / context branch changes (operational RPC scope)
    useEffect(() => {
        if (!companyId) return;
        const branchForBalances =
            branchId && branchId !== 'all'
                ? branchId
                : contextBranchId && contextBranchId !== 'all'
                  ? contextBranchId
                  : null;
        let cancelled = false;
        (async () => {
            const { map, error } = await contactService.getContactBalancesSummary(companyId, branchForBalances);
            if (cancelled) return;
            if (error && import.meta.env?.DEV) {
                console.warn('[SALE FORM] getContactBalancesSummary (branch refresh):', error);
            }
            setCustomers((prev) => {
                if (!prev.length) return prev;
                return prev.map((c) => {
                    const row = map.get(String(c.id));
                    return { ...c, dueBalance: row?.receivables ?? 0 };
                });
            });
        })();
        return () => {
            cancelled = true;
        };
    }, [companyId, branchId, contextBranchId]);

    // Separate useEffect to handle customer auto-selection AFTER customers array is updated
    // This ensures proper state sequencing - customers array updates first, then customerId
    useEffect(() => {
        if (pendingCustomerId && customers.length > 0) {
            // Find the customer in the updated array
            const foundCustomer = customers.find(c => {
                const cId = c.id?.toString() || '';
                const pendingIdStr = pendingCustomerId.toString();
                return cId === pendingIdStr || c.id === pendingCustomerId;
            });
            
            if (foundCustomer) {
                console.log('[SALE FORM] Found customer in array, setting customerId:', {
                    pendingId: pendingCustomerId,
                    foundId: foundCustomer.id,
                    foundName: foundCustomer.name,
                    customersCount: customers.length
                });
                
                // CRITICAL: Use the exact ID from foundCustomer to ensure consistency
                const customerIdToSet = foundCustomer.id.toString();
                
                // Set customerId - this will trigger selectedCustomer memo recalculation
                setCustomerId(customerIdToSet);
                
                // Force close popover and clear search immediately
                setCustomerSearchOpen(false);
                setCustomerSearchTerm('');
                
                // Clear pending AFTER setting customerId
                setPendingCustomerId(null);
                
                // Show toast
                toast.success(`Customer "${foundCustomer.name}" selected`);
                
                console.log('[SALE FORM] ✅ Auto-selected customer (via useEffect):', customerIdToSet, foundCustomer.name);
                
                // CRITICAL: Force a re-render by using requestAnimationFrame
                // This ensures React processes all state updates before next render
                requestAnimationFrame(() => {
                    // Verify state after React has processed updates
                    console.log('[SALE FORM] State verification after auto-select (RAF):', {
                        customerId,
                        selectedCustomerName: selectedCustomer?.name,
                        customersHasCustomer: customers.some(c => c.id.toString() === customerIdToSet),
                        foundCustomerInMemo: selectedCustomer?.id === customerIdToSet
                    });
                });
            } else {
                // Customer not found yet, might need more time
                console.warn('[SALE FORM] Pending customer not found in array yet:', {
                    pendingId: pendingCustomerId,
                    customersCount: customers.length,
                    customerIds: customers.map(c => c.id)
                });
            }
        }
    }, [pendingCustomerId, customers]);
    
    // 🔒 CRITICAL FIX: Set customer ID when editing, AFTER customers are loaded
    // This ensures the customer dropdown shows the correct selected customer
    useEffect(() => {
        if (initialSale && initialSale.customer) {
            const customerIdValue =
                coerceUuidOrNull(
                    (initialSale as { customer_id?: string }).customer_id ?? initialSale.customer,
                ) ?? '';
            
            // If customers are not loaded yet, set customerId anyway (will be validated when customers load)
            if (customers.length === 0) {
                console.log('[SALE FORM] Setting customer ID (customers not loaded yet):', customerIdValue);
                setCustomerId(customerIdValue);
                return; // Exit early, will re-run when customers load
            }
            
            // Customers are loaded, now find and set the exact match
            console.log('[SALE FORM] Setting customer ID in edit mode:', {
                customerIdValue,
                customersCount: customers.length,
                availableIds: customers.map(c => ({ id: c.id, idType: typeof c.id, idString: c.id?.toString() }))
            });
            
            // Find customer using multiple matching strategies (handle UUID format variations)
            const foundCustomer = customers.find(c => {
                const cId = c.id?.toString() || '';
                const cIdNormalized = cId.replace(/-/g, '').toLowerCase();
                const valueNormalized = customerIdValue.toString().replace(/-/g, '').toLowerCase();
                
                // Try multiple matching strategies
                return (
                    cId === customerIdValue.toString() ||           // Exact string match
                    c.id === customerIdValue ||                    // Direct comparison
                    String(c.id) === String(customerIdValue) ||    // String conversion match
                    cIdNormalized === valueNormalized              // Normalized UUID match (handles with/without dashes)
                );
            });
            
            if (foundCustomer) {
                // Use the exact ID from foundCustomer to ensure consistency with dropdown options
                const customerIdToSet = foundCustomer.id.toString();
                setCustomerId(customerIdToSet);
                console.log('[SALE FORM] ✅ Customer found and set in edit mode:', {
                    name: foundCustomer.name,
                    setId: customerIdToSet,
                    originalId: customerIdValue,
                    match: 'SUCCESS'
                });
            } else {
                // Customer ID not found in list - still set it but log detailed warning
                setCustomerId(customerIdValue);
                console.warn('[SALE FORM] ⚠️ Customer ID not found in customers array:', {
                    customerIdValue,
                    customerIdType: typeof customerIdValue,
                    availableIds: customers.map(c => ({
                        id: c.id,
                        idString: c.id?.toString(),
                        name: c.name
                    }))
                });
            }
        } else if (initialSale && !initialSale.customer) {
            // Sale exists but no customer (walk-in) - clear customer selection
            console.log('[SALE FORM] Sale has no customer (walk-in), clearing selection');
            setCustomerId('');
        }
    }, [initialSale, customers]); // Run when initialSale or customers change

    // Pre-populate form when editing (TASK 3 FIX) – date must come from DB, not current date
    useEffect(() => {
        if (initialSale) {
            const paidOptimistic = Number((initialSale as { paid?: number }).paid ?? 0);
            if (paidOptimistic > 0) {
                setPartialPayments([{
                    id: 'optimistic-paid',
                    method: ((initialSale as { paymentMethod?: string }).paymentMethod || 'cash') as 'cash' | 'bank' | 'Mobile Wallet',
                    amount: paidOptimistic,
                    reference: '',
                    attachments: [],
                    isExisting: true,
                }]);
            }
            if (initialSale.id) {
                setPaymentsLoading(true);
            }

            // Pre-fill header fields – use DB date so picker shows saved date (never current for saved sale)
            const dateRaw = initialSale.date || (initialSale as any).createdAt || (initialSale as any).invoice_date;
            if (dateRaw) {
                try {
                    if (typeof dateRaw === 'object' && dateRaw instanceof Date) {
                        setSaleDate(dateRaw);
                    } else {
                        const dateStr = typeof dateRaw === 'string' ? dateRaw.trim() : String(dateRaw);
                        const parsed = /^\d{4}-\d{2}-\d{2}T/.test(dateStr) ? parseISO(dateStr) : parseISO(dateStr);
                        setSaleDate(parsed);
                    }
                } catch {
                    setSaleDate(new Date(dateRaw));
                }
            } else {
                setSaleDate(new Date());
            }
            setSavedSaleAttachments(Array.isArray((initialSale as any)?.attachments) ? (initialSale as any).attachments : []);
            setInvoiceNumber(initialSale.invoiceNo || '');
            const isStudioRow =
              !!(initialSale as any).is_studio ||
              !!(initialSale as any).isStudioSale ||
              String((initialSale as any).order_no || '').startsWith('STD');
            setRefNumber(readSaleBillRef(initialSale as Record<string, unknown>, { isStudio: isStudioRow }));
            // Load notes; for studio sales set studioDeadline and Studio Notes input (studioNotes) so full note shows
            const { deadline, notesWithoutDeadline } = parseStudioDeadlineFromNotes(initialSale.notes);
            const loadedNotes = notesWithoutDeadline || '';
            setSaleNotes(loadedNotes);
            setStudioNotes(loadedNotes);
            const deadlineStr = (initialSale as any).deadline || deadline;
            if (deadlineStr) {
                try {
                    const d = new Date(deadlineStr);
                    studioDeadlineRef.current = d;
                    setStudioDeadline(d);
                } catch { /* ignore */ }
            } else {
                studioDeadlineRef.current = undefined;
                setStudioDeadline(undefined);
            }
            
            // Pre-fill items (from initialSale or fetch if missing)
            const mapItemsToForm = (list: any[]) => {
                if (!list || list.length === 0) return;
                const baseTimestamp = Date.now();
                // CRITICAL: Preselect variation when editing – use variation_id from DB so dropdown is not blank
                const convertedItems: SaleItem[] = list.map((item: any, index: number) => {
                    const variationId = item.variation_id ?? item.variationId ?? undefined;
                    const productForVar = item.product as
                        | { has_variations?: boolean; variations?: Array<{ id?: string; size?: string; color?: string; attributes?: Record<string, unknown> }> }
                        | undefined;
                    const showLineVariations = shouldShowSaleLineVariations(productForVar);
                    
                    // CRITICAL: packing_details might be JSONB (object) or JSON string
                    // Load complete structure, not just totals
                    let packingDetails = item.packing_details || item.packingDetails || null;
                    
                    // If packing_details is a string, parse it
                    if (typeof packingDetails === 'string') {
                        try {
                            packingDetails = JSON.parse(packingDetails);
                        } catch (e) {
                            console.warn('[SALE FORM] Failed to parse packing_details as JSON:', e);
                            packingDetails = null;
                        }
                    }
                    
                    // DEBUG: Log what we're loading
                    if (packingDetails) {
                        console.log('[SALE FORM] Loading packing details for item:', {
                            productName: item.productName || item.product_name,
                            packingDetails,
                            boxes: packingDetails.boxes,
                            boxesType: Array.isArray(packingDetails.boxes) ? 'array' : typeof packingDetails.boxes,
                            boxesLength: Array.isArray(packingDetails.boxes) ? packingDetails.boxes.length : 'N/A',
                            loose_pieces: packingDetails.loose_pieces
                        });
                        
                        if (packingDetails.boxes && Array.isArray(packingDetails.boxes)) {
                            packingDetails.boxes.forEach((box: any, idx: number) => {
                                console.log(`[SALE FORM] Box ${idx + 1} from DB:`, {
                                    box_no: box.box_no,
                                    pieces: box.pieces,
                                    piecesType: Array.isArray(box.pieces) ? 'array' : typeof box.pieces,
                                    piecesLength: Array.isArray(box.pieces) ? box.pieces.length : 'N/A'
                                });
                            });
                        }
                    }
                    
                    const parentDbId =
                        item.bespoke_parent_item_id ??
                        item.bespokeParentItemId ??
                        null;
                    const isFabricChild = !!parentDbId;
                    const dbLineId = String(item.id ?? item.dbLineId ?? '');
                    const details = parseCustomizationDetails(
                        item.customization_details ?? item.customizationDetails,
                    );
                    const storedUnitPrice = Number(item.price ?? item.unit_price ?? 0);
                    const productRetail = Number((item.product as { retail_price?: number } | undefined)?.retail_price ?? 0) || 0;
                    const resolvedStoredPrice =
                        storedUnitPrice > 0
                            ? storedUnitPrice
                            : isFabricChild && productRetail > 0
                              ? productRetail
                              : storedUnitPrice;
                    const baseUnitPrice = isFabricChild
                        ? resolvedStoredPrice
                        : deriveBaseUnitPriceFromStored(resolvedStoredPrice, details);

                    return {
                        id: baseTimestamp + index,
                        dbLineId,
                        bespokeParentItemId: parentDbId,
                        productId: item.productId || item.product_id || '',
                        name: item.productName || item.product_name || '',
                        sku: item.sku || '',
                        price: isFabricChild ? resolvedStoredPrice : baseUnitPrice,
                        baseUnitPrice,
                        qty: item.quantity || 0,
                        size: item.size,
                        color: item.color,
                        variationId,
                        selectedVariationId: variationId,
                        showVariations: isFabricChild ? false : showLineVariations,
                        stock: 0,
                        lastPurchasePrice: undefined,
                        lastSupplier: undefined,
                        unit: item.unit ?? undefined,
                        packingDetails: packingDetails,
                        thaans: packingDetails?.total_boxes || packingDetails?.boxes || 0,
                        meters: packingDetails?.total_meters || packingDetails?.meters || 0,
                        customizationDetails: buildBespokeMetadataForPersist(details) ?? details,
                        isBespokeInjected: !!parentDbId,
                        bespokeRole: parentDbId ? ('fabric' as const) : undefined,
                    };
                });
                const parentIdByDb = new Map<string, number>();
                convertedItems.forEach((row) => {
                    if (!row.bespokeParentItemId && row.dbLineId) {
                        parentIdByDb.set(row.dbLineId, row.id);
                    }
                });
                const linked = convertedItems.map((row) => {
                    if (!row.bespokeParentItemId) return row;
                    const parentCartId = parentIdByDb.get(String(row.bespokeParentItemId));
                    if (parentCartId == null) return row;
                    return { ...row, bespokeParentCartId: parentCartId };
                });
                console.log('[SALE FORM] ✅ Converted items for edit mode:', linked.length, 'items');
                setItems(linked);
            };
            // 🔒 LOCK CHECK: Prevent editing if sale has returns
            if (initialSale.id) {
                    saleService.getSaleById(initialSale.id)
                    .then(async (full) => {
                        // Check if sale has returns (LOCKED)
                        if (full.hasReturn) {
                            toast.error('Cannot edit sale: This sale has a return and is locked. Returns cannot be edited or deleted.');
                            onClose();
                            return;
                        }
                        // Same as Purchase: use raw API items so packing_details from DB is available for edit form
                        if (full.items && full.items.length > 0) {
                            mapItemsToForm(full.items);
                        } else {
                            const saleWithItems = convertFromSupabaseSale(full);
                            if (saleWithItems.items && saleWithItems.items.length > 0) {
                                mapItemsToForm(saleWithItems.items);
                            } else if (initialSale.items && initialSale.items.length > 0) {
                                mapItemsToForm(initialSale.items);
                            }
                        }
                        itemsHydratedRef.current = true;

                        // Always load payment history for edit/convert (deposits must reduce balance due)
                        setPaymentsLoading(true);
                        let paymentCount = 0;
                        try {
                            const existingPayments = await saleService.getSalePayments(initialSale.id);
                            paymentCount = existingPayments?.length ?? 0;
                            const paidFallback = Number((full as any).paid_amount ?? initialSale.paid ?? 0);
                            if (existingPayments && existingPayments.length > 0) {
                                setPartialPayments(
                                    existingPayments.map((p: any, index: number) => ({
                                        id: `existing-${p.id || index}`,
                                        method: (p.method === 'cash' ? 'cash'
                                            : p.method === 'bank' || p.method === 'card' ? 'bank'
                                            : 'Mobile Wallet') as 'cash' | 'bank' | 'Mobile Wallet',
                                        amount: p.amount,
                                        reference: p.referenceNo || '',
                                        attachments: [],
                                        isExisting: true,
                                    })),
                                );
                            } else if (paidFallback > 0) {
                                setPartialPayments([{
                                    id: '1',
                                    method: (initialSale.paymentMethod || 'cash') as 'cash' | 'bank' | 'Mobile Wallet',
                                    amount: paidFallback,
                                    reference: '',
                                    attachments: [],
                                    isExisting: true,
                                }]);
                            }
                        } catch (paymentErr) {
                            console.error('[SALE FORM] Error loading existing payments:', paymentErr);
                            const paidFallback = Number((full as any).paid_amount ?? initialSale.paid ?? 0);
                            if (paidFallback > 0) {
                                setPartialPayments([{
                                    id: '1',
                                    method: (initialSale.paymentMethod || 'cash') as 'cash' | 'bank' | 'Mobile Wallet',
                                    amount: paidFallback,
                                    reference: '',
                                    attachments: [],
                                    isExisting: true,
                                }]);
                            }
                        } finally {
                            setPaymentsLoading(false);
                        }
                        paymentsHydratedRef.current = true;

                        const fullBranchId = (full as { branch_id?: string }).branch_id;
                        if (fullBranchId && UUID_RE.test(String(fullBranchId))) {
                            setBranchId(String(fullBranchId));
                        }
                        const fullSalesmanId = (full as { salesman_id?: string | null }).salesman_id;
                        setSalesmanId(
                            fullSalesmanId && fullSalesmanId !== 'none' && fullSalesmanId !== '1'
                                ? String(fullSalesmanId)
                                : 'none',
                        );
                        const fullSubtotal = Number((full as { subtotal?: number }).subtotal) || Number(initialSale?.subtotal) || 0;
                        const fullPct = (full as { commission_percent?: number | null }).commission_percent;
                        const fullCommAmt = Number((full as { commission_amount?: number }).commission_amount) || 0;
                        if (fullPct != null && Number.isFinite(Number(fullPct))) {
                            setCommissionType('percentage');
                            setCommissionValue(Number(fullPct));
                        } else if (fullCommAmt > 0 && fullSubtotal > 0) {
                            setCommissionType('percentage');
                            setCommissionValue(Math.round((fullCommAmt / fullSubtotal) * 10000) / 100);
                        } else if (fullCommAmt > 0) {
                            setCommissionType('fixed');
                            setCommissionValue(fullCommAmt);
                        }

                        if (import.meta.env?.DEV) {
                            const sampleItem = full.items?.[0];
                            const cd = sampleItem?.customization_details ?? sampleItem?.customizationDetails;
                            console.log('[SALE FORM] Hydrate complete:', {
                                paymentCount,
                                paidAmount: (full as any).paid_amount,
                                customizationKeys: cd && typeof cd === 'object' ? Object.keys(cd as object) : [],
                            });
                        }
                        // Sync deadline & notes from DB so edit always shows saved values (not null)
                        const dbDeadline = (full as any).deadline || getStudioDeadlineFromNotes((full as any).notes);
                        if (dbDeadline) {
                            try {
                                const d = new Date(dbDeadline);
                                studioDeadlineRef.current = d;
                                setStudioDeadline(d);
                            } catch { /* ignore */ }
                        } else {
                            studioDeadlineRef.current = undefined;
                            setStudioDeadline(undefined);
                        }
                        const { notesWithoutDeadline } = parseStudioDeadlineFromNotes((full as any).notes);
                        const loadedNotes = notesWithoutDeadline || '';
                        setSaleNotes(loadedNotes);
                        setStudioNotes(loadedNotes);

                        void (async () => {
                            try {
                                const { supabase } = await import('@/lib/supabase');
                                const { data: prodRow } = await supabase
                                    .from('studio_productions')
                                    .select('design_name')
                                    .eq('sale_id', full.id)
                                    .maybeSingle();
                                const dn = prodRow?.design_name != null ? String(prodRow.design_name).trim() : '';
                                if (dn) setStudioProductName(dn);
                            } catch {
                                /* ignore */
                            }
                        })();

                        // Pre-fill from sale_charges: shipping → Shipping section; others → Extra Expenses
                        const charges = (full as any).charges ?? (full as any).sale_charges ?? [];
                        const chargeList = Array.isArray(charges) ? charges : [];
                        const shippingRows = chargeList.filter((c: any) => (c.charge_type || c.chargeType) === 'shipping');
                        const expenseRows = chargeList.filter((c: any) => (c.charge_type || c.chargeType) !== 'discount' && (c.charge_type || c.chargeType) !== 'shipping');
                        const shippingTotal = shippingRows.reduce((s: number, c: any) => s + (Number(c.amount) || 0), 0);
                        if (shippingTotal > 0) setShippingChargeInput(shippingTotal);
                        if (expenseRows.length > 0) {
                            const expenses = expenseRows.map((c: any, index: number) => ({
                                id: c.id?.toString() || String(index + 1),
                                type: c.charge_type || c.chargeType || 'other',
                                amount: Number(c.amount) || 0,
                                notes: (c as any).notes || '',
                                tailorContactId: (c as any).tailor_contact_id || undefined,
                                tailorExpenseCategoryId: (c as any).expense_category_id || undefined,
                            }));
                            setExtraExpenses(expenses);
                            const anyOffBill = expenseRows.some(
                                (c: any) => c.charged_to_customer === false,
                            );
                            setChargeExtrasToCustomer(!anyOffBill);
                        } else {
                            const extraFromDb =
                                Number((full as any).extra_expenses ?? 0) ||
                                (Number((full as any).expenses ?? 0) > 0 && Number((full as any).shipment_charges ?? 0) <= 0
                                    ? Number((full as any).expenses)
                                    : 0);
                            if (extraFromDb > 0) {
                                setExtraExpenses([{
                                    id: '1',
                                    type: 'stitching',
                                    amount: extraFromDb,
                                    notes: '',
                                }]);
                            }
                        }
                        extraExpensesHydratedRef.current = true;
                        setExtraExpensesHydrated(true);
                    })
                    .catch((err: any) => {
                        console.warn('[SaleForm] Could not load sale items for edit:', err);
                        extraExpensesHydratedRef.current = true;
                        setExtraExpensesHydrated(true);
                        if (err.message?.includes('return') || err.message?.includes('locked')) {
                            toast.error(err.message);
                            onClose();
                        }
                    });
            } else if (initialSale.items && initialSale.items.length > 0) {
                mapItemsToForm(initialSale.items);
                itemsHydratedRef.current = true;
            }

            // Pre-fill charges from context only when not loading full sale from API (id path hydrates async)
            if (!initialSale.id) {
            // Pre-fill from sale_charges: shipping → Shipping section; others → Extra Expenses. Exclude 'discount'.
            const charges = (initialSale as any).charges ?? (initialSale as any).sale_charges ?? [];
            const chargeList = Array.isArray(charges) ? charges : [];
            const shippingRows = chargeList.filter((c: any) => (c.charge_type || c.chargeType) === 'shipping');
            const expenseRows = chargeList.filter((c: any) => (c.charge_type || c.chargeType) !== 'discount' && (c.charge_type || c.chargeType) !== 'shipping');
            const shippingTotal = shippingRows.reduce((s: number, c: any) => s + (Number(c.amount) || 0), 0);
            if (shippingTotal > 0) setShippingChargeInput(shippingTotal);
            if (expenseRows.length > 0) {
                const expenses = expenseRows.map((c: any, index: number) => ({
                    id: c.id?.toString() || String(index + 1),
                    type: c.charge_type || c.chargeType || 'other',
                    amount: Number(c.amount) || 0,
                    notes: (c as any).notes || '',
                    tailorContactId: (c as any).tailor_contact_id || undefined,
                    tailorExpenseCategoryId: (c as any).expense_category_id || undefined,
                }));
                setExtraExpenses(expenses);
                const anyOffBill = expenseRows.some((c: any) => c.charged_to_customer === false);
                setChargeExtrasToCustomer(!anyOffBill);
            } else if (initialSale.expenses > 0) {
                setExtraExpenses([{
                    id: '1',
                    type: 'other',
                    amount: initialSale.expenses,
                    notes: 'Shipping/Other charges'
                }]);
                setShippingChargeInput(initialSale.expenses);
            }
            extraExpensesHydratedRef.current = true;
            setExtraExpensesHydrated(true);
            }
            
            // Pre-fill discount
            if (initialSale.discount > 0) {
                setDiscountValue(initialSale.discount);
                setDiscountType('fixed'); // Default to fixed, can be enhanced
            }
            
            // Pre-fill status from DB so draft stays draft when reopening (draft lifecycle fix)
            // When opened via "Convert to Final", show Final immediately so header and Shipment section are correct
            if (convertToFinal) {
                setSaleStatus('final');
            } else {
                const savedStatus = (initialSale as any).status ?? initialSale.type;
                if (savedStatus === 'draft' || savedStatus === 'quotation' || savedStatus === 'order' || savedStatus === 'final') {
                    setSaleStatus(savedStatus);
                } else if (initialSale.type === 'quotation') {
                    setSaleStatus('quotation');
                } else {
                    setSaleStatus('final');
                }
            }
            // Pre-fill Studio type when editing a studio sale
            if ((initialSale as any).is_studio) {
                setIsStudioSale(true);
            }
        }
    }, [initialSale, convertToFinal]);

    // Load sale_shipments when editing an existing sale
    useEffect(() => {
        if (!initialSale?.id) {
            setSaleShipments([]);
            return;
        }
        let cancelled = false;
        shipmentService.getBySaleId(initialSale.id)
            .then((rows) => {
                if (!cancelled) setSaleShipments(mapShipmentRowsToUi(rows));
            })
            .catch(() => { if (!cancelled) setSaleShipments([]); });
        return () => { cancelled = true; };
    }, [initialSale?.id]);

    // Couriers for shipment modal dropdown and Track Shipment URL (PART 2, PART 7)
    useEffect(() => {
        if (!companyId) return;
        let cancelled = false;
        courierService.getByCompanyId(companyId, false)
            .then((list) => { if (!cancelled) setCouriers(list); })
            .catch(() => { if (!cancelled) setCouriers([]); });
        return () => { cancelled = true; };
    }, [companyId]);

    // Status helper functions
    const getStatusColor = () => {
        switch(saleStatus) {
            case 'draft': return 'text-muted-foreground bg-muted/30 border-border';
            case 'quotation': return 'text-yellow-500 bg-yellow-900/20 border-yellow-600/50';
            case 'order': return 'text-blue-500 bg-blue-900/20 border-blue-600/50';
            case 'final': return 'text-green-500 bg-green-900/20 border-green-600/50';
            default: return 'text-muted-foreground bg-muted/30 border-border';
        }
    };

    // Chip-style status color for top header
    const getStatusChipColor = () => {
        switch(saleStatus) {
            case 'draft': return 'bg-gray-500/20 text-muted-foreground border-gray-600/50';
            case 'quotation': return 'bg-yellow-500/20 text-yellow-400 border-yellow-600/50';
            case 'order': return 'bg-blue-500/20 text-blue-400 border-blue-600/50';
            case 'final': return 'bg-green-500/20 text-[var(--erp-money-positive)] border-green-600/50';
            default: return 'bg-gray-500/20 text-muted-foreground border-gray-600/50';
        }
    };

    const getStatusIcon = () => {
        switch(saleStatus) {
            case 'draft': return <FileText size={14} />;
            case 'quotation': return <FileText size={14} />;
            case 'order': return <ShoppingBag size={14} />;
            case 'final': return <Check size={14} />;
            default: return <FileText size={14} />;
        }
    };

    // Get branch display (code + name)
    const getBranchName = () => {
        const branch = branches.find(b => b.id === branchId || b.id.toString() === branchId.toString());
        if (!branch) return "Select Branch";
        return branch.code ? `${branch.code} | ${branch.name}` : branch.name;
    };

    // Get selected customer - memoized to ensure it updates when customers or customerId changes
    // CRITICAL: This must update immediately when either customers array or customerId changes
    // Using JSON.stringify for customers array to ensure deep equality check
    // 🔒 CRITICAL FIX: Enhanced customer matching with UUID normalization
    const selectedCustomer = useMemo(() => {
        if (!customerId || !customers.length) {
            console.log('[SALE FORM] selectedCustomer memo: No customerId or customers empty', {
                customerId,
                customersCount: customers.length
            });
            return null;
        }
        
        const customerIdStr = customerId.toString();
        const customerIdNormalized = customerIdStr.replace(/-/g, '').toLowerCase();
        
        // Try multiple matching strategies to handle UUID format variations
        const customer = customers.find(c => {
            const cId = c.id?.toString() || '';
            const cIdNormalized = cId.replace(/-/g, '').toLowerCase();
            
            return (
                cId === customerIdStr ||                    // Exact string match
                c.id === customerId ||                      // Direct comparison
                String(c.id) === customerIdStr ||          // String conversion match
                cIdNormalized === customerIdNormalized      // Normalized UUID match (handles with/without dashes)
            );
        });
        
        console.log('[SALE FORM] selectedCustomer memo recalculated:', {
            customerId,
            customerIdType: typeof customerId,
            customersCount: customers.length,
            found: customer ? customer.name : 'NOT FOUND',
            foundId: customer ? customer.id : null,
            matchType: customer ? 'SUCCESS' : 'FAILED'
        });
        
        return customer || null;
    }, [customers, customerId]);
    
    const getSelectedCustomer = () => selectedCustomer;

    // Filter customers: name, code, phone (optional REF # is not on contact — list search only)
    const filteredCustomers = useMemo(() => {
        const q = customerSearchTerm.trim().toLowerCase();
        return customers.filter((c) => {
            if (!q) return true;
            const name = (c.name || '').toLowerCase();
            const code = String((c as { code?: string }).code || '').toLowerCase();
            const phone = String((c as { phone?: string }).phone || '').toLowerCase();
            return name.includes(q) || code.includes(q) || phone.includes(q);
        });
    }, [customers, customerSearchTerm]);

    useEffect(() => {
        if (!customerSearchOpen) return;
        setCustomerSearchHighlightIndex(filteredCustomers.length > 0 ? 0 : -1);
    }, [customerSearchOpen, customerSearchTerm, customers, filteredCustomers.length]);

    useEffect(() => {
        if (!customerSearchOpen) return;
        const id = requestAnimationFrame(() => customerPopoverSearchRef.current?.focus());
        return () => cancelAnimationFrame(id);
    }, [customerSearchOpen]);

    const selectCustomerFromDropdown = (cust: (typeof customers)[number]) => {
        setCustomerId(cust.id.toString());
        setCustomerSearchOpen(false);
        setCustomerSearchTerm('');
        setCustomerSearchHighlightIndex(-1);
    };

    const handleCustomerSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Tab') return;
        if (!filteredCustomers.length) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setCustomerSearchHighlightIndex((i) => {
                if (filteredCustomers.length === 0) return -1;
                if (i < 0) return 0;
                return Math.min(i + 1, filteredCustomers.length - 1);
            });
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setCustomerSearchHighlightIndex((i) => Math.max(0, i < 0 ? 0 : i - 1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const idx = customerSearchHighlightIndex >= 0 ? customerSearchHighlightIndex : 0;
            const cust = filteredCustomers[idx];
            if (cust) selectCustomerFromDropdown(cust);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setCustomerSearchOpen(false);
        }
    };

    // Helper to format due balance as currency (compact for header & dropdown). Uses Rs. for PKR globally.
    const formatDueBalanceCompact = (due: number) => {
        const code = company?.currency || 'PKR';
        const prec = company?.decimalPrecision ?? 2;
        return formatCurrency(due, code, prec);
    };

    // Helper to get due balance color: green = customer owes us, red = we owe customer
    const getDueBalanceColor = (due: number) => {
        if (due > 0) return 'text-[var(--erp-money-positive)]'; // Customer owes us (we took)
        if (due < 0) return 'text-red-400';   // We owe customer (we gave)
        return 'text-muted-foreground'; // Zero
    };

    // Display invoice number: final SL assigned on save via global RPC (no local counter preview)
    const displayInvoiceNumber = useMemo(() => {
        if (initialSale?.invoiceNo) {
            const inv = initialSale.invoiceNo;
            if (saleStatus === 'final' && isPreFinalSaleDocumentNo(inv)) {
                return 'Auto';
            }
            return inv;
        }
        if (isStudioSale) {
            if (typeof generateDocumentNumber === 'function') return generateDocumentNumber('studio');
            return 'STD-0001';
        }
        if (saleStatus === 'final') return 'Auto';
        if (typeof generateDocumentNumber !== 'function') return 'SDR-0001';
        const docType = saleStatus === 'quotation' ? 'quotation' : saleStatus === 'order' ? 'order' : 'draft';
        return generateDocumentNumber(docType);
    }, [initialSale?.invoiceNo, isStudioSale, saleStatus, generateDocumentNumber]);

    // Get selected customer's due balance
    const selectedCustomerDue = selectedCustomer?.dueBalance || 0;

    // --- Workflow Handlers ---

    // 1. Select Product -> Immediately add to items list (Selection = Add)
    const handleSelectProduct = (product: any) => {
        const newItemId = Date.now();
        
        // Check if product has real user-facing variations (not legacy sentinel rows)
        if (shouldShowSaleLineVariations(product, product.variations)) {
            // Add product with variation selector flag
            const newItem: SaleItem = {
                id: newItemId,
                productId: product.id,
                name: product.name,
                sku: product.sku,
                price: product.price,
                baseUnitPrice: product.price,
                qty: 1,
                size: undefined,
                color: undefined,
                stock: product.stock,
                lastPurchasePrice: product.lastPurchasePrice,
                lastSupplier: product.lastSupplier,
                showVariations: true, // Show variation selector inline
                unitAllowDecimal: product.unitAllowDecimal ?? false, // Pass unit decimal setting
            };

            setItems(prev => [newItem, ...prev]);
            toast.success("Item added - Select variation");
            
            // Set focus tracking for variation section
            setLastAddedItemId(newItemId);
        } else {
            // No variations - add directly
            const newItem: SaleItem = {
                id: newItemId,
                productId: product.id,
                name: product.name,
                sku: product.sku,
                price: product.price,
                baseUnitPrice: product.price,
                qty: 1,
                size: undefined,
                color: undefined,
                stock: product.stock,
                lastPurchasePrice: product.lastPurchasePrice,
                lastSupplier: product.lastSupplier,
                unitAllowDecimal: product.unitAllowDecimal ?? false, // Pass unit decimal setting
            };

            setItems(prev => [newItem, ...prev]);
            toast.success("Item added");
            
            // Set focus tracking for quantity input
            setLastAddedItemId(newItemId);
        }
        
        // Close search and reset
        setProductSearchOpen(false);
        setProductSearchTerm("");
    };

    // Auto-select product when created from Add Product drawer (Create New Product from Sale)
    useEffect(() => {
        if (!createdProduct || !setCreatedProduct) return;
        const p = createdProduct;
        const mapped = {
            id: p.id ?? p.uuid,
            name: p.name ?? '',
            sku: p.sku ?? '',
            price: Number(p.retail_price ?? p.price ?? 0),
            hasVariations: Array.isArray(p.variations) && p.variations.length > 0,
            stock: 0,
            lastPurchasePrice: p.cost_price != null ? Number(p.cost_price) : undefined,
            needsPacking: false,
        };
        setCreatedProduct(null);
        handleSelectProduct(mapped);
    }, [createdProduct, setCreatedProduct]);
    
    // Handle variation selection from inline row (variation from backend product.variations)
    const handleInlineVariationSelect = (itemId: number, variation: { id?: string; size?: string; color?: string; sku?: string; price?: number; stock?: number; attributes?: Record<string, unknown> }) => {
        setItems(prev => prev.map(item => {
            if (item.id === itemId) {
                const size = variation.size || variation.attributes?.size as string;
                const color = variation.color || variation.attributes?.color as string;
                const variationSku = variation.sku || `${item.sku}-${size}-${color}`.replace(/\s+/g, '-').toUpperCase();
                
                return {
                    ...item,
                    variationId: variation.id,
                    size: size,
                    color: color,
                    sku: variationSku, // Update SKU to variation-specific SKU
                    price: variation.price || item.price,
                    baseUnitPrice: variation.price ?? getSaleItemBasePrice(item),
                    stock: variation.stock ?? item.stock,
                    showVariations: false, // Hide variation selector
                    selectedVariationId: variation.id,
                };
            }
            return item;
        }));
        toast.success("Variation selected");
        
        // After variation is selected, focus quantity input
        setTimeout(() => {
            itemQtyRefs.current[itemId]?.focus();
        }, 50);
    };
    
    // Handle variation selection (deprecated - kept for compatibility)
    const handleVariationSelect = (variation: Variation) => {
        // Deprecated - variations now handled inline in item rows
    };

    // 2. Clear Pending Row (Reset to Search) - Deprecated, kept for compatibility
    const resetEntryRow = () => {
        setPendingProduct(null);
        setProductSearchTerm("");
        setPendingQty(1);
        setPendingPrice(0);
        setPendingSize("");
        setPendingColor("");
        setPendingThaans(0);
        setPendingMeters(0);
        setPendingPackingDetails(undefined);
        
        // Focus Search Input
        setTimeout(() => {
            searchInputRef.current?.focus();
        }, 50);
    };

    // 3. Add to List - Deprecated (items are now added immediately on selection)
    const commitPendingItem = () => {
        // This function is deprecated - items are added immediately on selection
        // Kept for compatibility but does nothing
    };

    // Items List Handlers
    // CRITICAL FIX: Ensure updateItem correctly updates the right item by ID
    const updateItem = (id: number, field: keyof SaleItem, value: number) => {
        setItems(prev => {
            const updated = prev.map(item => {
                if (item.id !== id) return item;
                if (field === 'price') {
                    if (isInjectedBespokeLine(item)) {
                        return { ...item, price: value };
                    }
                    return { ...item, price: value, baseUnitPrice: value };
                }
                const updatedItem = { ...item, [field]: value };
                console.log(`[SALE FORM] ✅ Updated item ID ${id} field ${field}:`, {
                    oldValue: item[field],
                    newValue: value,
                    itemName: item.name,
                    itemIndex: prev.findIndex(i => i.id === id)
                });
                return updatedItem;
            });
            console.log(`[SALE FORM] ✅ State updated. Total items: ${updated.length}, Updated item count: ${updated.filter((item, idx) => {
                const original = prev[idx];
                return original && item[field] !== original[field];
            }).length}`);
            return updated;
        });
    };

    const removeItem = (id: number) => {
        setItems((prev) =>
            prev.filter((item) => item.id !== id && item.bespokeParentCartId !== id),
        );
    };

    // Packing normalization: backend-ready shape (first-time save)
    const normalizePacking = (details: PackingDetails): PackingDetails => ({
        total_boxes: details.total_boxes ?? 0,
        total_pieces: details.total_pieces ?? 0,
        total_meters: details.total_meters ?? 0,
        boxes: (details.boxes && details.boxes.length > 0) ? details.boxes : [],
    });

    // Packing Handlers – single source of truth = sale item. On first save, commit immediately to item.
    const handleSavePacking = (itemId: number, details: PackingDetails) => {
        // DEBUG: Log what we're receiving and saving
        console.log('[SALE FORM] handleSavePacking called:', {
            itemId,
            details,
            boxes: details.boxes,
            boxesCount: details.boxes?.length,
            loose_pieces: details.loose_pieces,
            totals: {
                total_boxes: details.total_boxes,
                total_pieces: details.total_pieces,
                total_meters: details.total_meters
            }
        });
        
        // Verify structure integrity
        if (details.boxes && details.boxes.length > 0) {
            details.boxes.forEach((box, idx) => {
                console.log(`[SALE FORM] Box ${idx + 1} in details:`, {
                    box_no: box.box_no,
                    pieces: box.pieces,
                    piecesCount: box.pieces.length
                });
            });
        }
        
        // CRITICAL: Do NOT normalize - save complete structure as-is
        // normalizePacking might be filtering/reshaping data
        setItems(prev => prev.map(item => {
            if (item.id === itemId) {
                const updatedItem = {
                    ...item,
                    packingDetails: details, // CRITICAL: Save complete structure, not normalized
                    packing_quantity: details.total_meters,
                    packing_unit: 'meters',
                    qty: details.total_meters,
                    thaans: details.total_boxes,
                    meters: details.total_meters,
                    packingTouched: false,
                };
                
                console.log('[SALE FORM] Updated item packingDetails:', {
                    itemId: item.id,
                    packingDetails: updatedItem.packingDetails,
                    boxes: updatedItem.packingDetails?.boxes,
                    boxesCount: updatedItem.packingDetails?.boxes?.length
                });
                
                return updatedItem;
            }
            return item;
        }));
        toast.success("Packing details saved");
    };

    const handleSaveBespoke = (itemId: number, payload: BespokeInjectionPayload) => {
        const parent = items.find((i) => i.id === itemId);
        if (!parent) return;
        const { items: nextItems } = syncFabricChildLines(
            items,
            itemId,
            payload.fabrics,
            resolveFabricMaterialRetailPrice,
            () => Date.now() + Math.floor(Math.random() * 1000),
        );
        setItems(
            nextItems.map((row) => {
                if (row.id !== itemId) return row;
                const meta = buildBespokeMetadataForPersist(payload.metadata);
                return {
                    ...row,
                    customizationDetails: meta ?? undefined,
                    baseUnitPrice: row.baseUnitPrice ?? row.price,
                };
            }),
        );
        setBespokeItemId(null);
        toast.success('Customization saved — fabrics added as cart lines');
    };

    const openPackingModalLocal = (item: SaleItem) => {
        setActivePackingItemId(item.id);
        // Mark that user opened packing (for submit validation: block if not saved)
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, packingTouched: true } : i));
        if (openPackingModal) {
            openPackingModal({
                itemId: item.id,
                productName: item.name,
                initialData: item.packingDetails, // Pre-fill with existing data if editing
                onSave: (details) => handleSavePacking(item.id, details), // Pass itemId in closure – no reliance on state
            });
        }
    };

    const handleOpenPackingModalById = (itemId: number) => {
        if (!enablePacking) return;
        const item = items.find(i => i.id === itemId);
        if (item) openPackingModalLocal(item);
    };

    // Payment Handlers
    const addPartialPayment = () => {
        if (newPaymentAmount <= 0) return;
        
        // 🔧 FIX: Auto-generate unique reference number for each payment
        // Each payment method gets its own sequential reference number
        const autoReferenceNumber = generateDocumentNumber('payment');
        incrementNextNumber('payment');
        
        setPartialPayments(prev => [...prev, {
            id: Date.now().toString(),
            method: newPaymentMethod,
            amount: newPaymentAmount,
            reference: newPaymentReference || autoReferenceNumber, // Use manual reference if provided, otherwise auto-generate
            attachments: paymentAttachments
        }]);
        setNewPaymentAmount(0); // Reset input
        setNewPaymentReference(""); // Clear manual reference input
        setPaymentAttachments([]);
    };

    const removePartialPayment = (id: string) => {
        setPartialPayments(prev => prev.filter(p => p.id !== id));
    };

    // Extra Expenses Handlers
    const addExtraExpense = () => {
        if (newExpenseAmount <= 0) return;
        
        setExtraExpenses(prev => [...prev, {
            id: Date.now().toString(),
            type: newExpenseType,
            amount: newExpenseAmount,
            notes: newExpenseNotes,
            tailorExpenseCategoryId: newTailorCategoryId || undefined,
        }]);
        setNewExpenseAmount(0); // Reset input
        setNewExpenseNotes("");
        setNewTailorCategoryId("");
        toast.success("Expense added");
    };

    const removeExtraExpense = (id: string) => {
        setExtraExpenses(prev => prev.filter(exp => exp.id !== id));
    };

    const openShipmentModal = (forUpdate: boolean) => {
        if (forUpdate && saleShipments.length > 0) setEditingShipmentId(saleShipments[0].id);
        else setEditingShipmentId(null);
        setShowShipmentModal(true);
    };

    const handleDeleteShipment = async (shipmentId: string) => {
        const shipment = saleShipments.find(s => s.id === shipmentId);
        if (!shipment || !initialSale?.id) return;
        if (!confirm(`Remove this shipment? Bill will decrease by ${(shipment.chargedToCustomer || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}.`)) return;
        try {
            await shipmentService.delete(shipmentId);
            setSaleShipments(prev => prev.filter(s => s.id !== shipmentId));
            toast.success('Shipment removed');
        } catch (e: any) {
            toast.error(e?.message || 'Failed to remove shipment');
        }
    };

    const getCustomerName = () => customers.find(c => c.id.toString() === customerId)?.name || "Select Customer";
    
    // Handle Save
    const handleSave = async (print: boolean = false) => {
        if (needsConvertHydration && !convertHydrationReady) {
            toast.error('Still loading order data. Please wait a moment.');
            return;
        }
        if (!customerId || customerId === '') {
            toast.error('Please select a customer');
            return;
        }
        
        // CRITICAL FIX: Validate unit decimal rules before save
        for (const item of items) {
            if (item.unitAllowDecimal === false && item.qty % 1 !== 0) {
                toast.error(`Item "${item.name}": This product unit does not allow decimal quantities. Please enter a whole number.`);
                return;
            }
        }
        
        if (items.length === 0) {
            toast.error(isStudioSale
              ? 'Studio order must have at least one product (fabric/material). Add an item before saving.'
              : 'Please add at least one item');
            return;
        }

        if (isStudioSale && !String(studioProductName ?? '').trim()) {
            toast.error('Studio product name is required.');
            return;
        }

        // HARD validation: packing opened but not saved → block submit (only when packing is enabled)
        if (enablePacking) {
            const packingOpenedNotSaved = items.some(i => i.packingTouched && !i.packingDetails);
            if (packingOpenedNotSaved) {
                toast.error('Please save packing for all items where packing was opened.');
                setSaving(false);
                return;
            }
        }

        // RULE 4: Variation selection required when product has variations
        const itemWithoutVariation = items.find(i => i.showVariations && !i.selectedVariationId && !i.variationId);
        if (itemWithoutVariation) {
            toast.error(`Variation selection required for "${itemWithoutVariation.name}". Please select a size/color (or combination) before saving.`);
            setSaving(false);
            return;
        }

        // If status is final, show payment choice for new sale or convert-to-final
        if (saleStatus === 'final' && (!initialSale || isOrderToFinal)) {
            setPendingSaveAction({ print });
            setPaymentChoiceDialogOpen(true);
            return;
        }

        // For draft/quotation/order, or when editing, save directly without payment
        await proceedWithSave(print);
    };

    // Guard: one click = one save (prevents double submit / duplicate key)
    const saveInProgressRef = useRef(false);

    // Actual save logic (extracted from handleSave)
    // Returns the created/updated sale ID and invoice number if payment dialog should open
    const proceedWithSave = async (print: boolean = false, shouldOpenPaymentDialog: boolean = false): Promise<{ saleId: string | null; invoiceNo: string | null }> => {
        if (saveInProgressRef.current) return null;
        if (convertToFinal && initialSale?.id && !convertHydrationReady) {
            toast.error('Order data is still loading — please wait before saving.');
            return null;
        }
        try {
            saveInProgressRef.current = true;
            setSaving(true);
            let saveT = webSaveTimingStart('sale:proceedWithSave');
            
            const selectedCustomer = customers.find(c => c.id.toString() === customerId);
            const customerName = selectedCustomer?.name || 'Walk-in Customer';
            let customerUuid: string | undefined;
            if (customerId === 'walk-in') {
                const walkIn = await contactService.getWalkingCustomer(companyId);
                customerUuid = walkIn?.id ?? undefined;
            } else {
                customerUuid = coerceUuidOrNull(customerId) ?? undefined;
            }
            saveT = webSaveTimingMark('sale:resolveCustomer', saveT);
            
            // CRITICAL FIX: Convert items to SaleItem format with variationId
            const orderedItems = orderSaleLinesForPersist(
              items.map((item) => ({
                ...item,
                productId: item.productId.toString(),
              })),
            );

            const productIdsNeedingVariation = [
              ...new Set(
                orderedItems
                  .filter(
                    (item) =>
                      !item.variationId &&
                      !(item as { selectedVariationId?: string }).selectedVariationId &&
                      (item.size || item.color),
                  )
                  .map((item) => item.productId.toString()),
              ),
            ];
            const productById = new Map<string, { variations?: any[] }>();
            for (const pid of productIdsNeedingVariation) {
              const cached = products.find((p) => String(p.id) === pid);
              if (cached?.variations?.length) productById.set(pid, cached);
            }
            const missingProductIds = productIdsNeedingVariation.filter((pid) => !productById.has(pid));
            if (missingProductIds.length > 0) {
              await Promise.all(
                missingProductIds.map(async (pid) => {
                  try {
                    const product = await productService.getProduct(pid);
                    if (product) productById.set(pid, product);
                  } catch {
                    /* variation lookup optional */
                  }
                }),
              );
            }
            saveT = webSaveTimingMark('sale:variationPrefetch', saveT);

            const saleItems = orderedItems.map((item, index) => {
                const selectedVar = (item as { selectedVariationId?: string }).selectedVariationId;
                let variationId: string | undefined =
                  selectedVar || item.variationId || undefined;

                if (!variationId && (item.size || item.color)) {
                  const product = productById.get(item.productId.toString());
                  if (product?.variations?.length) {
                    const matchingVariation = product.variations.find((v: any) => {
                      const vSize = v.size || v.attributes?.size;
                      const vColor = v.color || v.attributes?.color;
                      return vSize === item.size && vColor === item.color;
                    });
                    if (matchingVariation) variationId = matchingVariation.id;
                  }
                }
                
                // Same as Purchase: context expects packingDetails (camelCase); it maps to packing_details for DB
                const rawCustomization =
                  item.customizationDetails ?? (item as { customization_details?: unknown }).customization_details;
                const persistedCustomization = buildCustomizationDetailsForPersist(rawCustomization);
                const unitPrice = getSaleItemUnitPrice(item);
                const saleItem = {
                  id: item.id.toString(),
                  productId: item.productId.toString(),
                  productName: item.name,
                  sku: item.sku,
                  quantity: item.qty,
                  price: unitPrice,
                  baseUnitPrice: item.baseUnitPrice,
                  discount: 0,
                  tax: 0,
                  total: unitPrice * item.qty,
                  variationId: variationId,
                  parentLineIndex: (item as { parentLineIndex?: number }).parentLineIndex,
                  bespokeParentItemId: item.bespokeParentItemId ?? undefined,
                  bespokeParentCartId: item.bespokeParentCartId,
                  ...(enablePacking ? {
                    packingDetails: item.packingDetails,
                    packing_type: item.packingDetails?.packing_type || undefined,
                    packing_quantity: item.packingDetails?.total_meters || item.meters || undefined,
                    packing_unit: item.packingDetails?.packing_unit || 'meters',
                    thaans: item.thaans,
                    meters: item.meters
                  } : { packingDetails: undefined, packing_type: undefined, packing_quantity: undefined, packing_unit: undefined, thaans: undefined, meters: undefined }),
                  customizationDetails: persistedCustomization,
                };
                
                if (import.meta.env?.DEV) {
                  console.log(`[SALE FORM] ✅ Converted item ${index}:`, {
                    id: saleItem.id,
                    productId: saleItem.productId,
                    name: saleItem.productName,
                    qty: saleItem.quantity,
                    unitPrice: saleItem.price,
                    baseUnitPrice: saleItem.baseUnitPrice,
                    hasCustomization: persistedCustomization != null,
                  });
                }
                
                return saleItem;
              });
            
            saveT = webSaveTimingMark('sale:mapItems', saveT);
            
            if (import.meta.env?.DEV) {
              console.log('[SALE FORM] Final saleItems array length:', saleItems.length);
            }
            
            // CRITICAL FIX: Map sale status correctly
            // Draft → status: 'draft', type: 'quotation'
            // Quotation → status: 'quotation', type: 'quotation'
            // Order → status: 'order', type: 'quotation'
            // Final → status: 'final', type: 'invoice'
            // Studio (STD): Always treat as CUSTOMER ORDER only — no accounting. Only SL invoice creates revenue.
            const isNewStudioSale = isStudioSale && !(initialSale && initialSale.id);
            const saleType: 'invoice' | 'quotation' = isNewStudioSale ? 'quotation' : (saleStatus === 'final' ? 'invoice' : 'quotation');
            const mappedStatus: 'draft' | 'quotation' | 'order' | 'final' = isNewStudioSale ? 'order' : saleStatus;
            
            // INVOICE PREFIX RULE: Regular sale → generateDocumentNumber('invoice') → SL. Studio → generateDocumentNumber('studio') → STD. Separate counters; never mix.
            // Same-row final: convertToFinal uses global SL counter (not display-prefix inference).
            let documentNumber: string;
            let documentType: 'draft' | 'quotation' | 'order' | 'invoice' | 'studio';
            
            if (initialSale?.id && isOrderToFinal && companyId) {
                documentType = 'invoice';
                documentNumber = await documentNumberService.getNextDocumentNumberGlobal(companyId, 'SL');
            } else if (initialSale && initialSale.invoiceNo) {
                // EDIT MODE: Preserve existing invoice number UNLESS type was changed to Studio (then use next STD-XXXX)
                const existingIsStudio = initialSale.invoiceNo.startsWith('STD-') || initialSale.invoiceNo.startsWith('ST-');
                if (isStudioSale && !existingIsStudio) {
                    // Type changed to Studio → next STD from DB (updateSale does not allocate; sync hook can return empty)
                    documentType = 'studio';
                    try {
                        documentNumber = companyId
                            ? await documentNumberService.getNextDocumentNumberGlobal(companyId, 'STD')
                            : generateDocumentNumber('studio');
                    } catch {
                        documentNumber = generateDocumentNumber('studio');
                    }
                    } else {
                    if (saleStatus === 'final' && isPreFinalSaleDocumentNo(initialSale.invoiceNo)) {
                        documentNumber = companyId
                            ? await documentNumberService.getNextDocumentNumberGlobal(companyId, 'SL')
                            : generateDocumentNumber('invoice');
                        documentType = 'invoice';
                    } else {
                        documentNumber = initialSale.invoiceNo;
                        // Determine document type from existing invoice number prefix
                        if (documentNumber.startsWith('DRAFT-') || documentNumber.startsWith('SDR-')) {
                            documentType = 'draft';
                        } else if (documentNumber.startsWith('QT-') || documentNumber.startsWith('SQT-')) {
                            documentType = 'quotation';
                        } else if (documentNumber.startsWith('SO-') || documentNumber.startsWith('SOR-')) {
                            documentType = 'order';
                        } else if (documentNumber.startsWith('SL-') || documentNumber.startsWith('INV-')) {
                            documentType = 'invoice';
                        } else if (documentNumber.startsWith('STD-') || documentNumber.startsWith('ST-')) {
                            documentType = 'studio'; // STD is canonical; ST- for legacy
                        } else {
                            documentType = saleStatus === 'final' ? (isStudioSale ? 'studio' : 'invoice') : 
                                          saleStatus === 'quotation' ? 'quotation' :
                                          saleStatus === 'order' ? 'order' : 'draft';
                        }
                    }
                }
            } else {
                // NEW SALE: Regular → SL (invoice). Studio → STD (studio). No shared counter.
                if (isStudioSale) {
                    documentType = 'studio';
                    documentNumber = generateDocumentNumber('studio');
                } else {
                    switch (saleStatus) {
                        case 'draft':
                            documentType = 'draft';
                            documentNumber = generateDocumentNumber('draft');
                            break;
                        case 'quotation':
                            documentType = 'quotation';
                            documentNumber = generateDocumentNumber('quotation');
                            break;
                        case 'order':
                            documentType = 'order';
                            documentNumber = generateDocumentNumber('order');
                            break;
                        case 'final':
                            documentType = 'invoice';
                            documentNumber = '';
                            break;
                        default:
                            documentType = 'draft';
                            documentNumber = generateDocumentNumber('draft');
                    }
                }
            }
            
            // CRITICAL FIX: For draft/quotation/order, force payment to 0 and payment_status to 'unpaid'
            // Payment should only be allowed for final sales. New Studio (STD) is order-only — no payment.
            const effectiveFinal = mappedStatus === 'final';
            const finalPaid = effectiveFinal ? totalPaid : 0;
            const finalDue = effectiveFinal ? balanceDue : totalAmount;
            const finalPaymentStatus: 'paid' | 'partial' | 'unpaid' = effectiveFinal ? paymentStatus : 'unpaid';
            
            // Branch: require selection only when multi-branch AND user has no branch mapping (requiresBranchSelection)
            const singleBranchId = accessibleBranches.length === 1 ? accessibleBranches[0]?.id : null;
            const finalBranchId = singleBranchId
                ? singleBranchId
                : (isAdmin ? (branchId || contextBranchId || '') : (contextBranchId || branchId || ''));
            const isValidBranch = finalBranchId && finalBranchId !== 'all' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(finalBranchId);
            const branchSelectionRequired = accessibleBranches.length > 1;
            if (branchSelectionRequired && !isValidBranch) {
                toast.error('Please select a branch before saving');
                saveInProgressRef.current = false;
                setSaving(false);
                return null;
            }
            // Only show "no branch" error when we truly have no valid branch (e.g. single-branch context may have set contextBranchId before branches list loaded)
            if (!isValidBranch && (requiresBranchSelection || (accessibleBranches.length === 0 && !isAdmin))) {
                toast.error(
                    requiresBranchSelection
                        ? 'Your user is not assigned to any branch. Ask admin to assign a branch.'
                        : 'No branch available. Please contact admin.'
                );
                saveInProgressRef.current = false;
                setSaving(false);
                return null;
            }
            
            // Create sale data
            const saleData = {
                type: saleType,
                status: mappedStatus,
                invoiceNo: documentNumber, // Status-based document number (draft/final/studio)
                customer: customerUuid || '',
                customerName: customerName,
                contactNumber: '', // Can be enhanced to get from customer
                date: formatDateWithTimezone(saleDate),
                location: finalBranchId, // CRITICAL: Always use validated branch ID
                items: saleItems,
                itemsCount: items.length,
                subtotal: subtotal,
                discount: discountAmount,
                tax: 0, // Can be enhanced later
                expenses: expensesTotal + (initialSale?.id ? 0 : (shippingChargeInput || 0)),
                // PF-03 / Issue 02: When shipping is present, persist product-only total so trigger sets due_amount = (total + shipment_charges) - paid (no double count)
                // Create/convert: product-only total + due from trigger after shipment row created. Edit: same when sale has or will have shipping.
                total: (() => {
                    const hasShipping = saleShipments.length > 0 || (shippingChargeInput || 0) > 0;
                    if (hasShipping && (!initialSale?.id || !!isOrderToFinal)) return afterDiscountTotal; // new/convert with shipping
                    if (hasShipping && initialSale?.id) return afterDiscountTotal; // PF-03: edit with shipping → product-only
                    return totalAmount;
                })(),
                paid: finalPaid,
                due: (() => {
                    const hasShipping = saleShipments.length > 0 || (shippingChargeInput || 0) > 0;
                    const effShipping = initialSale?.id ? (saleShipments.length > 0 ? shipmentChargesFromApi : (shippingChargeInput || 0)) : (shippingChargeInput || 0);
                    if (hasShipping && (!initialSale?.id || !!isOrderToFinal)) return Math.max(0, afterDiscountTotal - totalPaid);
                    if (hasShipping && initialSale?.id) return Math.max(0, (afterDiscountTotal + effShipping) - totalPaid); // PF-03: edit with shipping
                    return finalDue;
                })(),
                returnDue: 0,
                paymentStatus: finalPaymentStatus,
                paymentMethod: (effectiveFinal && partialPayments.length > 0) ? partialPayments[0].method : 'cash',
                shippingStatus: 'pending' as const,
                notes: (() => {
                    const merged = mergeCustomerBillRefIntoNotes(refNumber, saleNotes || studioNotes || '');
                    return isStudioSale
                        ? buildNotesWithStudioDeadline(studioDeadline, merged)
                        : merged || undefined;
                })(),
                customerBillRef: refNumber.trim() || undefined,
                deadline: (() => {
                    const d = studioDeadlineRef.current ?? studioDeadline;
                    // Persist for studio + orders; also keep existing date when converting order→final
                    const keepOnFinal = saleStatus === 'final' && !!d;
                    const persistDeadline = isStudioSale || saleStatus === 'order' || keepOnFinal;
                    const value = persistDeadline && d ? d.toISOString().split('T')[0] : null;
                    if (import.meta.env?.DEV && persistDeadline) {
                        console.log('[SALE FORM] Saving deadline:', value, 'from ref:', !!studioDeadlineRef.current, 'state:', !!studioDeadline);
                    }
                    return value;
                })(),
                // CRITICAL: Include extra expenses; shipping from sale_shipments when editing, or shippingChargeInput when new
                extraExpenses: extraExpenses,
                chargeExtrasToCustomer,
                replaceSaleCharges: true,
                shippingCharges: effectiveShippingCharges,
                commissionAmount: commissionAmount,
                commissionEligibleAmount: subtotal,
                salesmanId: (salesmanId && salesmanId !== "1" && salesmanId !== "none") ? salesmanId : null,
                commissionPercent: commissionType === 'percentage' ? commissionValue : null,
                // CRITICAL FIX: Pass partialPayments array for splitting into separate payment records
                partialPayments: (effectiveFinal && partialPayments.length > 0) ? partialPayments : [],
                // Studio sale: show on Studio page and use studio invoice numbering
                isStudioSale: isStudioSale,
                is_studio: isStudioSale,
                ...(isStudioSale ? { studioDesignName: String(studioProductName ?? '').trim() } : {}),
            };
            
            // Same row: new sale → create; edit or convert-to-final → update
            if (initialSale && initialSale.id) {
                // EDIT MODE: Update existing sale (invoice number updated when converting to Studio / final)
                await updateSale(initialSale.id, saleData);
                if (saleAttachmentFiles.length > 0 && companyId) {
                    try {
                        const uploaded = await uploadSaleAttachments(companyId, initialSale.id, saleAttachmentFiles);
                        const existing = (initialSale as any)?.attachments || [];
                        const merged = Array.isArray(existing) ? [...existing, ...uploaded] : uploaded;
                        if (merged.length > 0) await updateSale(initialSale.id, { attachments: merged } as any);
                        setSaleAttachmentFiles([]);
                        setSavedSaleAttachments(merged);
                    } catch (e) {
                        console.warn('[SALE FORM] Attachment upload failed:', e);
                        toast.warning('Sale saved but some attachments could not be uploaded.');
                    }
                }
                // If we regenerated invoice for Studio conversion, consume studio number so next studio sale gets next STD
                if (isStudioSale && !initialSale.invoiceNo.startsWith('STD-') && !initialSale.invoiceNo.startsWith('ST-')) {
                    incrementNextNumber('studio');
                }
                if (isOrderToFinal) {
                    saleFormBootstrapCache.clear();
                    await refreshSales();
                    toast.success(`Order converted to invoice ${documentNumber}`);
                } else {
                    toast.success(`Sale ${documentNumber} updated successfully!`);
                }
                
                // Store sale ID and invoice number for payment dialog (edit mode)
                setSavedSaleId(initialSale.id);
                setSavedSaleInvoiceNo(documentNumber);
                
                if (print) {
                    try {
                        const full = await saleService.getSaleById(initialSale.id);
                        const saleToPrint = full ? convertFromSupabaseSale(full) : null;
                        if (saleToPrint) {
                            setSaleForPrint(saleToPrint);
                            setShowPrintLayout(true);
                        }
                    } catch (e) {
                        toast.warning('Sale saved. Open it from the list to print.');
                    }
                    return { saleId: initialSale.id, invoiceNo: documentNumber };
                }
                
                // If payment dialog should open, don't close form yet
                if (shouldOpenPaymentDialog) {
                    // Don't close form - payment dialog will open
                    return { saleId: initialSale.id, invoiceNo: documentNumber };
                }
                
                // Close form
                onClose();
                return { saleId: initialSale.id, invoiceNo: documentNumber };
            } else {
                const created = await createSale(saleData);
                webSaveTimingMark('sale:createSale', saveT);
                // Increment local counter only for stage numbers (draft/qt/order/studio); final SL is global RPC
                if (documentType !== 'invoice') {
                    incrementNextNumber(documentType);
                }
                if (!convertToFinal) {
                    toast.success(`${saleType === 'invoice' ? 'Invoice' : 'Quotation'} created successfully!`);
                }
                if (created?.id) {
                    setSavedSaleId(created.id);
                    setSavedSaleInvoiceNo(created.invoiceNo ?? documentNumber);
                }
                // Non-critical post-save work — do not block success toast / payment dialog
                if (created?.id && (shippingChargeInput || 0) > 0 && companyId && finalBranchId) {
                    void shipmentService.create(
                        created.id,
                        companyId,
                        finalBranchId,
                        {
                            shipment_type: 'Courier',
                            charged_to_customer: shippingChargeInput,
                            actual_cost: 0,
                            currency: 'PKR',
                            shipment_status: 'Pending',
                        },
                        undefined,
                        created.invoiceNo ?? documentNumber
                    ).catch((shipErr: unknown) => {
                        const msg = shipErr instanceof Error ? shipErr.message : String(shipErr);
                        console.warn('[SALE FORM] Shipment record for shipping charge could not be created:', msg);
                    });
                }
                if (created?.id && saleAttachmentFiles.length > 0 && companyId) {
                    const filesToUpload = saleAttachmentFiles;
                    void uploadSaleAttachments(companyId, created.id, filesToUpload)
                        .then(async (uploaded) => {
                            if (uploaded.length > 0) await updateSale(created.id, { attachments: uploaded } as any);
                            setSaleAttachmentFiles([]);
                            setSavedSaleAttachments(uploaded);
                        })
                        .catch((e) => {
                            console.warn('[SALE FORM] Attachment upload failed:', e);
                            toast.warning('Sale created but some attachments could not be uploaded.');
                        });
                }
                
                // Studio sale: after save, open Studio Sale Detail for this sale (single master page)
                if (isStudioSale && created?.id && setSelectedStudioSaleId && setCurrentView) {
                  setSelectedStudioSaleId(created.id);
                  closeDrawer();
                  setCurrentView('studio-sale-detail-new');
                  return { saleId: null, invoiceNo: null, studioRedirect: true }; // Don't open payment dialog – we navigated to studio
                }
                
                if (print && created) {
                    setSaleForPrint(created);
                    setShowPrintLayout(true);
                }
                
                // If payment dialog should open, don't close form yet
                if (shouldOpenPaymentDialog && created?.id) {
                    // Don't close form - payment dialog will open
                    return { saleId: created.id, invoiceNo: created.invoiceNo ?? documentNumber };
                }
                
                // Close form (unless payment dialog will open or print view is showing)
                if (!shouldOpenPaymentDialog && !print) {
                    onClose();
                }
                
                // Return sale ID and invoice number for payment dialog
                return { saleId: created?.id || null, invoiceNo: (created?.invoiceNo ?? documentNumber) || null };
            }
        } catch (error: any) {
            console.error('[SALE FORM] Error saving sale:', error);
            toast.error(`Failed to save sale: ${error.message || 'Unknown error'}`);
            return null;
        } finally {
            saveInProgressRef.current = false;
            setSaving(false);
        }
    };

    // Keyboard navigation: Auto-focus after item is added
    useEffect(() => {
        if (lastAddedItemId !== null) {
            setTimeout(() => {
                const item = items.find(i => i.id === lastAddedItemId);
                if (item) {
                    if (item.showVariations) {
                        // Focus first variation button
                        itemVariationRefs.current[lastAddedItemId]?.focus();
                    } else {
                        // Focus quantity input
                        itemQtyRefs.current[lastAddedItemId]?.focus();
                    }
                }
                setLastAddedItemId(null);
            }, 100);
        }
    }, [lastAddedItemId, items]);
    
    // Keyboard handlers for navigation
    const handleQtyKeyDown = (e: React.KeyboardEvent, itemId: number) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            itemPriceRefs.current[itemId]?.focus();
        }
    };
    
    const handlePriceKeyDown = (e: React.KeyboardEvent, itemId: number) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            // Return focus to search input
            setProductSearchOpen(true);
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 50);
        }
    };

    // Show loader while loading data
    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-background">
                <Loader2 size={48} className="text-blue-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
            {/* ============ LAYER 1: FIXED HEADER ============ */}
            <div className="shrink-0 bg-popover border-b border-border z-20">
                {/* Top Bar - Single Row with Invoice, Status, Salesman, Branch */}
                <div className="h-12 flex items-center justify-between px-6 border-b border-border/50">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={onClose} className="text-muted-foreground hover:text-foreground h-8 w-8">
                            <X size={18} />
                        </Button>
                        <div>
                            <h2 className="text-sm font-bold text-foreground">New Sale Invoice</h2>
                            <p className="text-[10px] text-muted-foreground">Standard Entry</p>
                        </div>
                        {/* Invoice Number - Moved to LEFT side after title (wait for settings so studio number comes from DB) */}
                        <div className="flex items-center gap-2 ml-4 pl-4 border-l border-border">
                            <Hash size={14} className="text-cyan-500" />
                            <span className="text-sm font-mono text-cyan-400">
                                {displayInvoiceNumber === '' && isStudioSale && !initialSale?.invoiceNo
                                    ? (settingsLoading ? 'Loading...' : '...')
                                    : displayInvoiceNumber}
                            </span>
                        </div>
                        {/* Type (Regular / Studio) — Studio hidden when module disabled */}
                        {studioModuleEnabled ? (
                            <Popover open={typeDropdownOpen} onOpenChange={setTypeDropdownOpen}>
                                <PopoverTrigger asChild>
                                    <button
                                        type="button"
                                        className="flex items-center gap-2 bg-card border border-border rounded-lg px-2.5 py-1 hover:bg-accent transition-colors cursor-pointer h-8"
                                    >
                                        <Tag size={14} className="text-muted-foreground shrink-0" />
                                        <span className="text-xs text-foreground capitalize">{isStudioSale ? 'Studio' : 'Regular'}</span>
                                        <ChevronRight size={12} className="text-muted-foreground rotate-90 shrink-0" />
                                    </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-48 bg-popover border-border text-popover-foreground p-2" align="start">
                                    <div className="space-y-1">
                                        {(['regular', 'studio'] as const).map((t) => (
                                            <button
                                                key={t}
                                                type="button"
                                                onClick={() => {
                                                    setIsStudioSale(t === 'studio');
                                                    if (t === 'studio') setShippingEnabled(false);
                                                    setTypeDropdownOpen(false);
                                                }}
                                                className={cn(
                                                    'w-full text-left px-3 py-2 rounded-md text-sm transition-all flex items-center gap-2',
                                                    (isStudioSale ? 'studio' : 'regular') === t
                                                        ? 'bg-muted text-foreground'
                                                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                                                )}
                                            >
                                                <Tag size={16} className={cn(
                                                    (isStudioSale ? 'studio' : 'regular') === t ? 'text-blue-400' : 'text-muted-foreground'
                                                )} />
                                                <span className="capitalize">{t}</span>
                                            </button>
                                        ))}
                                    </div>
                                </PopoverContent>
                            </Popover>
                        ) : (
                            <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-2.5 py-1 h-8">
                                <Tag size={14} className="text-muted-foreground shrink-0" />
                                <span className="text-xs text-foreground capitalize">
                                    {isStudioSale ? 'Studio' : 'Regular'}
                                </span>
                            </div>
                        )}
                        {/* Delivery — regular orders only (studio uses Deadline in studio panel) */}
                        {saleStatus === 'order' && !isStudioSale && (
                            <div className="flex items-center gap-1.5 ml-1">
                                <CalendarIcon size={14} className="text-muted-foreground shrink-0" />
                                <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">Delivery</span>
                                <div className="w-[140px] [&_button]:h-8 [&_button]:min-h-8 [&_button]:text-xs [&_button]:px-2 [&_button]:rounded-lg">
                                    <DatePicker
                                        value={studioDeadline ? formatLocalDateYYYYMMDD(studioDeadline) : ''}
                                        onChange={(v) => {
                                            const d = v ? parseLocalDateInput(v) : undefined;
                                            studioDeadlineRef.current = d;
                                            setStudioDeadline(d);
                                        }}
                                        placeholder="Delivery date"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right side: Status, Salesman, Branch */}
                    <div className="flex items-center gap-4">
                        
                        {/* Status - Chip Style */}
                        <Popover open={statusDropdownOpen} onOpenChange={(open) => {
                            if (!(initialSale && initialSale.type !== 'quotation')) {
                                setStatusDropdownOpen(open);
                            }
                        }}>
                            <PopoverTrigger asChild>
                                <button
                                    type="button"
                                    disabled={initialSale && initialSale.type !== 'quotation'}
                                    className={cn(
                                        "px-3 py-1 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5",
                                        getStatusChipColor(),
                                        initialSale && initialSale.type !== 'quotation' 
                                            ? "opacity-50 cursor-not-allowed" 
                                            : "hover:opacity-80 cursor-pointer"
                                    )}
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                                    {saleStatus.charAt(0).toUpperCase() + saleStatus.slice(1)}
                                </button>
                            </PopoverTrigger>
                            <PopoverContent 
                                className="w-48 bg-popover border-border text-popover-foreground p-2"
                                align="start"
                            >
                                <div className="space-y-1">
                                    {(['draft', 'quotation', 'order', 'final'] as const).map((s) => {
                                        const isFinalSale = initialSale && initialSale.type !== 'quotation';
                                        const isDisabled =
                                            (isFinalSale && s === 'draft') ||
                                            (initialOrderStatus && s === 'final' && !convertToFinal);
                                        return (
                                        <button
                                            key={s}
                                            type="button"
                                            disabled={isDisabled}
                                            onClick={() => {
                                                if (isDisabled) {
                                                    if (initialOrderStatus && s === 'final') {
                                                        toast.info('Use “Convert to Final” from the sales list to finalize this order.');
                                                    }
                                                    return;
                                                }
                                                setSaleStatus(s);
                                                setStatusDropdownOpen(false);
                                            }}
                                            className={cn(
                                                "w-full text-left px-3 py-2 rounded-md text-sm transition-all flex items-center gap-2",
                                                saleStatus === s
                                                    ? "bg-muted text-foreground"
                                                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                                                isDisabled && "opacity-50 cursor-not-allowed"
                                            )}
                                        >
                                            <span className={cn(
                                                "w-1.5 h-1.5 rounded-full",
                                                s === 'draft' && "bg-gray-500",
                                                s === 'quotation' && "bg-yellow-500",
                                                s === 'order' && "bg-blue-500",
                                                s === 'final' && "bg-green-500"
                                            )}></span>
                                            {s.charAt(0).toUpperCase() + s.slice(1)}
                                        </button>
                                    )})}
                                        </div>
                            </PopoverContent>
                        </Popover>

                        {/* Salesman: admin/owner picker; workers auto-assigned read-only */}
                        {canAssignCommission ? (
                            <Popover open={salesmanDropdownOpen} onOpenChange={setSalesmanDropdownOpen}>
                                <PopoverTrigger asChild>
                                    <button
                                        type="button"
                                        className="flex items-center gap-2 bg-card border border-border rounded-lg px-2.5 py-1 hover:bg-accent transition-colors cursor-pointer"
                                    >
                                        <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-foreground text-[10px] font-semibold">
                                            {getSalesmanName().charAt(0).toUpperCase()}
                                        </div>
                                        <span className="text-xs text-foreground">{getSalesmanName()}</span>
                                        <ChevronRight size={12} className="text-muted-foreground rotate-90" />
                                    </button>
                                </PopoverTrigger>
                                <PopoverContent 
                                    className="w-56 bg-popover border-border text-popover-foreground p-2"
                                    align="start"
                                >
                                    <div className="space-y-1">
                                        {salesmen.map((s) => (
                                            <button
                                                key={s.id}
                                                type="button"
                                                onClick={() => {
                                                    setSalesmanId(s.id.toString());
                                                    setSalesmanDropdownOpen(false);
                                                }}
                                                className={cn(
                                                    "w-full text-left px-3 py-2 rounded-md text-sm transition-all flex items-center gap-2",
                                                    salesmanId === s.id.toString()
                                                        ? "bg-muted text-foreground"
                                                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                                                )}
                                            >
                                                <div className={cn(
                                                    "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold",
                                                    salesmanId === s.id.toString() ? "bg-blue-600 text-white" : "bg-muted text-muted-foreground"
                                                )}>
                                                    {s.name.charAt(0).toUpperCase()}
                                                </div>
                                                <span>{s.code ? `${s.code} | ${s.name}` : s.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </PopoverContent>
                            </Popover>
                        ) : (
                            <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-2.5 py-1 text-muted-foreground">
                                <div className="w-5 h-5 rounded-full bg-blue-600/70 flex items-center justify-center text-foreground text-[10px] font-semibold">
                                    {getSalesmanName().charAt(0).toUpperCase()}
                                </div>
                                <span className="text-xs">Salesperson: {getSalesmanName()}</span>
                            </div>
                        )}

                        {/* Branch - Chip: dropdown only when multiple accessible branches */}
                        {showBranchSelector ? (
                        <Popover open={branchDropdownOpen} onOpenChange={setBranchDropdownOpen}>
                            <PopoverTrigger asChild>
                                <button
                                    type="button"
                                    className="flex items-center gap-2 bg-card border border-border rounded-lg px-2.5 py-1 hover:bg-accent transition-colors cursor-pointer"
                                >
                                    <Building2 size={14} className="text-muted-foreground shrink-0" />
                                    <span className="text-xs text-foreground">{getBranchName()}</span>
                                    <ChevronRight size={12} className="text-muted-foreground rotate-90" />
                                </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 bg-popover border-border text-popover-foreground p-2" align="end">
                                <div className="space-y-1">
                                    {accessibleBranches.map((b) => (
                                        <button
                                            key={b.id}
                                            type="button"
                                            onClick={() => {
                                                setBranchId(b.id);
                                                setBranchDropdownOpen(false);
                                            }}
                                            className={cn(
                                                "w-full text-left px-3 py-2 rounded-md text-sm transition-all flex items-center gap-2",
                                                branchId === b.id || branchId === b.id.toString()
                                                    ? "bg-muted text-foreground"
                                                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                                            )}
                                        >
                                            <Building2 size={16} className={cn(
                                                branchId === b.id || branchId === b.id.toString() ? "text-blue-400" : "text-muted-foreground"
                                            )} />
                                            <span>{b.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </PopoverContent>
                        </Popover>
                        ) : (
                        <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-2.5 py-1 opacity-90">
                            <Building2 size={14} className="text-muted-foreground shrink-0" />
                            <span className="text-xs text-foreground">{getBranchName()}</span>
                        </div>
                        )}
                                </div>
                            </div>

                {/* FORM HEADER: Customer, Date, Ref #, Type */}
                <div className="px-6 py-4 bg-secondary">
                    <div className="invoice-container mx-auto w-full max-w-[1151px]">
                        <div className="bg-muted/30 border border-border rounded-lg p-3 min-h-[85px] w-full">
                            <div className="flex items-end gap-3 w-full flex-wrap">
                                {/* Customer – same layout as Purchase Supplier */}
                                <div className="flex flex-col flex-1 min-w-0 min-w-[200px]">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <Label className="text-orange-400 font-medium text-[10px] uppercase tracking-wide h-[14px]">Customer</Label>
                                        {customerId && (
                                            <span className={cn("absolute left-[672px] text-[15px] font-semibold tabular-nums", getDueBalanceColor(selectedCustomerDue))}>
                                                {formatDueBalanceCompact(selectedCustomerDue)}
                                            </span>
                                        )}
                                    </div>
                            <Popover 
                                key={`customer-select-${customerId || 'none'}-${customers.length}-${selectedCustomer?.id || 'none'}`} 
                                open={customerSearchOpen} 
                                onOpenChange={(open) => {
                                    setCustomerSearchOpen(open);
                                    if (!open) setCustomerSearchHighlightIndex(-1);
                                }}
                            >
                                <PopoverTrigger asChild>
                                    <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-2.5 py-1 hover:bg-accent transition-colors cursor-pointer w-[748px] h-10 min-h-[40px]">
                                        <User size={14} className="text-muted-foreground shrink-0" />
                                        <span 
                                            className="text-xs text-foreground flex-1 truncate text-left"
                                            key={`customer-name-display-${customerId || 'none'}-${selectedCustomer?.name || 'none'}`}
                                        >
                                            {selectedCustomer?.name || "Select Customer"}
                                        </span>
                                        {/* Plus icon inside search field - NOT a button to avoid nesting */}
                                        <div
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openDrawer('addContact', 'addSale', { 
                                                    contactType: 'customer',
                                                    prefillName: customerSearchTerm || undefined
                                                });
                                                setCustomerSearchOpen(false);
                                                setCustomerSearchTerm('');
                                            }}
                                            className="p-0.5 hover:bg-accent rounded transition-colors cursor-pointer"
                                        >
                                            <Plus size={12} className="text-muted-foreground hover:text-blue-400" />
                                            </div>
                                        <ChevronRight size={12} className="text-muted-foreground rotate-90 shrink-0" />
                                            </div>
                                </PopoverTrigger>
                                <PopoverContent 
                                    className="w-80 bg-popover border-border text-popover-foreground p-2 flex flex-col overflow-hidden max-h-[320px]"
                                    align="start"
                                >
                                    <div className="space-y-2 flex flex-col min-h-0 flex-1 overflow-hidden">
                                        {/* Search Input */}
                                        <Input
                                            ref={customerPopoverSearchRef}
                                            placeholder="Search customers..."
                                            value={customerSearchTerm}
                                            onChange={(e) => setCustomerSearchTerm(e.target.value)}
                                            onKeyDown={handleCustomerSearchKeyDown}
                                            className="bg-muted border-border text-foreground text-sm h-9 shrink-0"
                                            autoComplete="off"
                                        />
                                        {/* Customer List - scrollable; wheel + touch scroll (no tabIndex — keeps Tab order natural) */}
                                        <div
                                            className="space-y-1 overflow-y-auto overflow-x-hidden overscroll-contain max-h-64"
                                            style={{ WebkitOverflowScrolling: 'touch' }}
                                            role="listbox"
                                            aria-label="Customers"
                                            onWheel={(e) => e.stopPropagation()}
                                        >
                                            {filteredCustomers.length === 0 ? (
                                                <div className="px-3 py-2 text-sm text-muted-foreground text-center">
                                                    No customers found
                                            </div>
                                            ) : (
                                                <>
                                                    {filteredCustomers.map((cust, idx) => {
                                                        const cidStr =
                                                            customerId != null && customerId !== ''
                                                                ? String(customerId)
                                                                : '';
                                                        const isSelectedRow = customerSearchHighlightIndex === idx;
                                                        return (
                                                        <button
                                                            key={cust.id}
                                                            type="button"
                                                            role="option"
                                                            aria-selected={isSelectedRow}
                                                            onMouseEnter={() => setCustomerSearchHighlightIndex(idx)}
                                                            onClick={() => selectCustomerFromDropdown(cust)}
                                                            className={cn(
                                                                "w-full text-left px-3 py-2 rounded-md text-sm transition-all flex items-center justify-between",
                                                                // 🔒 CRITICAL FIX: Use normalized comparison for UUID matching (customerId may be non-string from API)
                                                                (cidStr === cust.id.toString() ||
                                                                 cidStr === String(cust.id) ||
                                                                 (cidStr &&
                                                                    cust.id &&
                                                                    cidStr.replace(/-/g, '').toLowerCase() ===
                                                                        cust.id.toString().replace(/-/g, '').toLowerCase()))
                                                                    ? "bg-muted text-foreground"
                                                                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                                                                isSelectedRow && "ring-1 ring-inset ring-blue-500 bg-muted/90"
                                                            )}
                                                        >
                                                            <span className="font-medium">{cust.name}</span>
                                                            <span className={cn(
                                                                "text-xs font-semibold tabular-nums ml-2",
                                                                cust.dueBalance > 0 && "text-[var(--erp-money-positive)]",
                                                                cust.dueBalance < 0 && "text-red-400",
                                                                cust.dueBalance === 0 && "text-muted-foreground"
                                                            )}>
                                                                {formatDueBalanceCompact(cust.dueBalance)}
                                                            </span>
                                                        </button>
                                                    );
                                                    })}
                                                </>
                                            )}
                                            </div>
                                    </div>
                                </PopoverContent>
                            </Popover>
                                </div>
                                {/* Date – bill / invoice date */}
                                <div className="flex flex-col w-[184px] absolute left-[798px] top-[77px] z-0">
                                    <Label className="text-muted-foreground font-medium text-xs uppercase tracking-wide h-[14px] mb-1.5">Date</Label>
                                    <div className="[&>div>button]:bg-muted/30 [&>div>button]:border-border [&>div>button]:text-foreground [&>div>button]:text-xs [&>div>button]:h-10 [&>div>button]:min-h-[40px] [&>div>button]:px-2.5 [&>div>button]:py-1 [&>div>button]:rounded-lg [&>div>button]:border [&>div>button]:hover:bg-accent [&>div>button]:w-full [&>div>button]:justify-start" style={{ width: '209px' }}>
                                        <DateTimePicker
                                            value={dateToDateTimePickerValue(saleDate)}
                                            onChange={(v) => setSaleDate(dateTimePickerValueToDate(v) || new Date())}
                                            required
                                        />
                                    </div>
                                </div>
                                {/* REF # – same as PurchaseForm */}
                                <div className="flex flex-col w-[132px] shrink-0">
                                    <Label className="text-muted-foreground font-medium text-xs uppercase tracking-wide h-[14px] mb-1.5">REF #</Label>
                                    <div className="relative">
                                        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                                        <Input
                                            value={refNumber}
                                            onChange={(e) => setRefNumber(e.target.value)}
                                            className="pl-9 bg-muted/30 border-border h-10 text-sm text-foreground placeholder:text-muted-foreground"
                                            placeholder="Optional"
                                        />
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>

                    {/* Studio Details - Inline when active */}
                    {isStudioSale && (
                        <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-2 flex flex-col gap-2 mt-3">
                            <div className="flex items-center gap-2 flex-wrap">
                                <div className="flex items-center gap-1.5 text-xs text-purple-400 shrink-0">
                                    <Palette size={12} />
                                    <Scissors size={12} />
                                    <Sparkles size={12} />
                                </div>
                                <div className="flex-1 min-w-[200px] flex flex-col gap-0.5">
                                    <Label className="text-[10px] uppercase tracking-wide text-purple-400/90">Studio product name</Label>
                                    <Input
                                        required
                                        value={studioProductName}
                                        onChange={(e) => setStudioProductName(e.target.value)}
                                        placeholder="Required — e.g. replica / outfit name"
                                        className="h-8 bg-input-background border-purple-500/30 text-foreground text-xs placeholder:text-purple-400/30"
                                    />
                                </div>
                                <div className="w-40">
                                    <Label className="text-[10px] uppercase tracking-wide text-purple-400/90 mb-0.5 block">Deadline</Label>
                                    <DatePicker
                                        value={studioDeadline ? formatLocalDateYYYYMMDD(studioDeadline) : ''}
                                        onChange={(v) => {
                                            const d = v ? parseLocalDateInput(v) : undefined;
                                            studioDeadlineRef.current = d;
                                            setStudioDeadline(d);
                                        }}
                                        placeholder="Deadline"
                                    />
                                </div>
                            </div>
                            <Input
                                placeholder="Production notes (optional)..."
                                value={studioNotes}
                                onChange={(e) => setStudioNotes(e.target.value)}
                                className="w-full h-7 bg-input-background border-purple-500/30 text-foreground text-xs placeholder:text-purple-400/30"
                            />
                        </div>
                    )}
            </div>
            </div>

            {/* ============ LAYER 2: SCROLLABLE MAIN CONTENT (DUAL PANEL) ============ */}
            <div className="flex-1 overflow-hidden">
                <div className="invoice-container mx-auto px-6 h-full">
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-3 h-full py-3">
                        
                        {/* LEFT PANEL - Items Entry (Independent Scroll) */}
                        <div className="flex flex-col h-full overflow-hidden">
                            <SaleItemsSection
                    items={items}
                    setItems={setItems}
                    productSearchOpen={productSearchOpen}
                    setProductSearchOpen={setProductSearchOpen}
                    productSearchTerm={productSearchTerm}
                    setProductSearchTerm={setProductSearchTerm}
                    pendingProduct={pendingProduct}
                    setPendingProduct={setPendingProduct}
                    pendingQty={pendingQty}
                    setPendingQty={setPendingQty}
                    pendingPrice={pendingPrice}
                    setPendingPrice={setPendingPrice}
                    pendingSize={pendingSize}
                    setPendingSize={setPendingSize}
                    pendingColor={pendingColor}
                    setPendingColor={setPendingColor}
                    pendingThaans={pendingThaans}
                    setPendingThaans={setPendingThaans}
                    pendingMeters={pendingMeters}
                    setPendingMeters={setPendingMeters}
                    filteredProducts={filteredProducts}
                    handleSelectProduct={handleSelectProduct}
                    handleAddItem={commitPendingItem}
                    handleOpenPackingModal={handleOpenPackingModalById}
                    enablePacking={enablePacking}
                    enableBespoke={enableBespoke}
                    onOpenBespokeModal={(id) => setBespokeItemId(id)}
                    searchInputRef={searchInputRef}
                    qtyInputRef={qtyInputRef}
                    priceInputRef={priceInputRef}
                    addBtnRef={addBtnRef}
                    showVariationSelector={showVariationSelector}
                    selectedProductForVariation={selectedProductForVariation}
                    productVariations={productVariationsFromBackend}
                    handleVariationSelect={handleVariationSelect}
                    setShowVariationSelector={setShowVariationSelector}
                    setSelectedProductForVariation={setSelectedProductForVariation}
                    handleInlineVariationSelect={handleInlineVariationSelect}
                    isEditMode={Boolean(initialSale)}
                    updateItem={updateItem}
                    getLineUnitPrice={getSaleItemUnitPrice}
                    getLineBasePrice={getSaleItemBasePrice}
                    formatCurrencyDisplay={formatCurrency}
                    itemQtyRefs={itemQtyRefs}
                    itemPriceRefs={itemPriceRefs}
                    itemVariationRefs={itemVariationRefs}
                    handleQtyKeyDown={handleQtyKeyDown}
                    handlePriceKeyDown={handlePriceKeyDown}
                    lastAddedItemId={lastAddedItemId}
                            />
                        </div>

                        {/* RIGHT PANEL - Summary + Payment (Independent Scroll) */}
                        <div className="flex flex-col h-full overflow-y-auto space-y-3 pb-3">
                            {/* PART 8 order: Extra Expenses → Shipping Charge → Shipment → Attachments → Invoice Summary */}
                            {/* Extra Expenses — enabled when status is Order or Final */}
                            <div className={cn("bg-card border border-border rounded-lg p-4 shrink-0", saleExtrasPanelLocked && "opacity-60 pointer-events-none")}>
                                <div className="flex items-center justify-between mb-3">
                                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                                    <DollarSign size={14} className="text-purple-500" />
                                    Extra Expenses
                                </h3>
                                {extraExpenses.length > 0 && (
                                    <Badge className="bg-purple-600 text-white text-sm px-2 py-0.5">
                                        {expensesTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </Badge>
                                )}
                                </div>
                                {saleExtrasPanelLocked && (
                                    <p className="text-xs text-muted-foreground mb-2">Set sale status to <strong className="text-muted-foreground">Order</strong> or <strong className="text-muted-foreground">Final</strong> to use extra expenses, shipping, shipment, and attachments.</p>
                                )}

                                <label className="flex items-start gap-2 mb-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={chargeExtrasToCustomer}
                                        onChange={(e) => setChargeExtrasToCustomer(e.target.checked)}
                                        disabled={saleExtrasPanelLocked}
                                        className="mt-0.5"
                                    />
                                    <span className="text-xs text-muted-foreground">
                                        Add extra expenses to customer bill
                                        <span className="block text-muted-foreground mt-0.5">
                                            Off = inclusive in package (4120 split on GL). Max 25% of invoice when off.
                                        </span>
                                    </span>
                                </label>

                                {/* Add Expense Form - More Compact */}
                                <div className="flex flex-col gap-2 mb-3">
                                    <div className="flex gap-2 flex-wrap">
                                    <Select value={newExpenseType} onValueChange={(v: any) => { setNewExpenseType(v); setNewTailorCategoryId(''); }}>
                                        <SelectTrigger className="w-[110px] bg-input-background border-border text-foreground h-8 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-input-background border-border text-foreground">
                                            <SelectItem value="stitching">Stitching</SelectItem>
                                            <SelectItem value="lining">Lining</SelectItem>
                                            <SelectItem value="dying">Dying</SelectItem>
                                            <SelectItem value="cargo">Cargo</SelectItem>
                                            <SelectItem value="other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {(newExpenseType === 'stitching' || newExpenseType === 'lining' || newExpenseType === 'dying') && (
                                      <Select value={newTailorCategoryId || '_none'} onValueChange={(v) => setNewTailorCategoryId(v === '_none' ? '' : v)}>
                                        <SelectTrigger className="min-w-[140px] flex-1 bg-input-background border-border text-foreground h-8 text-xs">
                                          <SelectValue placeholder="Tailor / dyer" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-input-background border-border text-foreground">
                                          <SelectItem value="_none">Tailor / dyer (optional)</SelectItem>
                                          {tailorOptionsForNewExpense.map((t) => (
                                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    )}
                                    </div>
                                    <div className="flex gap-2">
                                    <Input 
                                        type="number" 
                                        placeholder="Amount" 
                                        className="bg-input-background border-border text-foreground h-8 w-[90px] text-xs"
                                        value={newExpenseAmount > 0 ? newExpenseAmount : ''}
                                        onChange={(e) => setNewExpenseAmount(parseFloat(e.target.value) || 0)}
                                    />
                                    <Input 
                                        type="text" 
                                        placeholder="Notes (optional)" 
                                        className="bg-input-background border-border text-foreground h-8 flex-1 text-xs"
                                        value={newExpenseNotes}
                                        onChange={(e) => setNewExpenseNotes(e.target.value)}
                                    />
                                    <Button onClick={addExtraExpense} className="bg-purple-600 hover:bg-purple-500 h-8 w-8 p-0">
                                        <Plus size={14} />
                                    </Button>
                                    </div>
                                </div>

                                {/* Expenses List - Only show if exists */}
                                {extraExpenses.length > 0 && (
                                    <div className="space-y-1.5">
                                        {extraExpenses.map((expense) => (
                                            <div key={expense.id} className="flex justify-between items-center p-2 bg-input-background rounded border border-border/50 hover:border-purple-500/30 transition-colors">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded bg-purple-600/20 flex items-center justify-center">
                                                        <DollarSign size={10} className="text-purple-400" />
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-medium text-foreground capitalize">{expense.type}</div>
                                                        {(expense.tailorExpenseCategoryId || expense.notes) && (
                                                          <div className="text-[10px] text-muted-foreground">
                                                            {[
                                                              expense.tailorExpenseCategoryId
                                                                ? tailorNameByCategoryId(expenseCategoryTree, expense.tailorExpenseCategoryId)
                                                                : null,
                                                              expense.notes,
                                                            ].filter(Boolean).join(' · ')}
                                                          </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium text-foreground">{expense.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                    <button onClick={() => removeExtraExpense(expense.id)} className="text-muted-foreground hover:text-red-400">
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Shipping Charge — enabled when status is Order or Final */}
                            <div className={cn("bg-card border border-border rounded-lg p-3 shrink-0", saleExtrasPanelLocked && "opacity-60 pointer-events-none")}>
                                <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wide flex items-center gap-2 mb-2">
                                    <Truck size={14} />
                                    Shipping Charge
                                </h3>
                                {initialSale?.id && saleShipments.length > 0 ? (
                                    <p className="text-sm text-foreground font-medium">{shipmentChargesFromApi.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                ) : (
                                    <Input
                                        type="number"
                                        min={0}
                                        placeholder="Amount"
                                        className="bg-input-background border-border text-foreground h-9 text-sm"
                                        value={shippingChargeInput > 0 ? shippingChargeInput : ''}
                                        onChange={(e) => setShippingChargeInput(parseFloat(e.target.value) || 0)}
                                    />
                                )}
                            </div>

                            {/* Shipment — enabled when status is Order or Final (saved sale required) */}
                            <div className={cn("bg-card border border-border rounded-lg p-3 shrink-0", saleExtrasPanelLocked && "opacity-60 pointer-events-none")}>
                                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                                    <Truck size={14} />
                                    Shipment
                                </h3>
                                {saleExtrasActive && initialSale?.id ? (
                                    saleShipments.length === 0 ? (
                                        <Button type="button" variant="outline" size="sm" className="w-full border-gray-600 text-blue-400 hover:bg-blue-900/20" onClick={() => openShipmentModal(false)}>
                                            <Plus size={14} className="mr-2" />
                                            Add Shipment
                                        </Button>
                                    ) : (
                                        <div className="space-y-2">
                                            {(() => {
                                                const s = saleShipments[0];
                                                const courierForTrack = s.courierMasterId ? couriers.find((c) => c.id === s.courierMasterId) : null;
                                                const trackUrl = courierService.buildTrackingUrl(courierForTrack?.tracking_url ?? null, s.trackingId);
                                                const statusIcon = (st: string) => st === 'Delivered' || st === 'delivered' ? '✅' : (st === 'In Transit' || st === 'Out for Delivery' ? '🚚' : st === 'Cancelled' || st === 'cancelled' ? '❌' : '📦');
                                                return (
                                                    <>
                                                        <div className="flex items-center justify-between gap-2 text-sm">
                                                            <span className="text-muted-foreground">Courier:</span>
                                                            <span className="text-foreground">{s.courierName || '—'}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between gap-2 text-sm">
                                                            <span className="text-muted-foreground">Tracking:</span>
                                                            <span className="text-foreground font-mono truncate">{s.trackingId || '—'}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="text-muted-foreground text-sm">Status:</span>
                                                            <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                                                {statusIcon(s.shipmentStatus)} {s.shipmentStatus}
                                                            </span>
                                                        </div>
                                                        {trackUrl && (
                                                            <Button type="button" variant="outline" size="sm" className="w-full border-gray-600 text-blue-400 hover:bg-blue-900/20" asChild>
                                                                <a href={trackUrl} target="_blank" rel="noopener noreferrer">
                                                                    <ExternalLink size={14} className="mr-2" />
                                                                    Track Shipment
                                                                </a>
                                                            </Button>
                                                        )}
                                                        <Button type="button" variant="outline" size="sm" className="w-full border-gray-600 text-orange-400 hover:bg-orange-900/20" onClick={() => openShipmentModal(true)}>
                                                            <Edit size={14} className="mr-2" />
                                                            Update Shipment
                                                        </Button>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    )
                                ) : saleExtrasActive ? (
                                    <p className="text-xs text-muted-foreground">Save the sale first to add shipment</p>
                                ) : (
                                    <p className="text-xs text-muted-foreground">Set status to Order or Final to use shipment</p>
                                )}
                            </div>

                            {/* Attachments — enabled when status is Order or Final */}
                            <div className={cn("bg-card border border-border rounded-lg p-4 space-y-3 shrink-0", saleExtrasPanelLocked && "opacity-60 pointer-events-none")}>
                                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                                    <Paperclip size={14} />
                                    Attachments
                                </h3>
                                <input
                                    ref={saleAttachmentInputRef}
                                    type="file"
                                    accept="image/*,.pdf,application/pdf"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => {
                                        void (async () => {
                                            const files = e.target.files;
                                            if (!files?.length) return;
                                            setIsProcessingSaleAttachments(true);
                                            try {
                                                const valid = Array.from(files).filter((f) => f.type.startsWith('image/') || f.type === 'application/pdf');
                                                if (valid.length < (files.length || 0)) toast.error('Only images and PDF allowed.');
                                                const { files: processed, compressionMessages, skippedMessages } =
                                                    await prepareAttachmentFilesForUpload(valid, ATTACHMENT_MAX_BYTES);
                                                skippedMessages.forEach((msg) => toast.error(msg));
                                                compressionMessages.forEach((msg) => toast.success(msg));
                                                if (processed.length) setSaleAttachmentFiles((prev) => [...prev, ...processed]);
                                            } finally {
                                                setIsProcessingSaleAttachments(false);
                                                e.target.value = '';
                                            }
                                        })();
                                    }}
                                />
                                <label className="block cursor-pointer">
                                    <div
                                        className="border-2 border-dashed border-border rounded-lg p-3 hover:border-blue-500/50 hover:bg-accent/30 transition-all text-center"
                                        onClick={() => saleAttachmentInputRef.current?.click()}
                                        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-blue-500/50', 'bg-muted/30'); }}
                                        onDragLeave={(e) => { e.currentTarget.classList.remove('border-blue-500/50', 'bg-muted/30'); }}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            e.currentTarget.classList.remove('border-blue-500/50', 'bg-muted/30');
                                            void (async () => {
                                                const files = e.dataTransfer.files;
                                                if (!files?.length) return;
                                                setIsProcessingSaleAttachments(true);
                                                try {
                                                    const valid = Array.from(files).filter((f) => f.type.startsWith('image/') || f.type === 'application/pdf');
                                                    const { files: processed, compressionMessages, skippedMessages } =
                                                        await prepareAttachmentFilesForUpload(valid, ATTACHMENT_MAX_BYTES);
                                                    skippedMessages.forEach((msg) => toast.error(msg));
                                                    compressionMessages.forEach((msg) => toast.success(msg));
                                                    if (processed.length) setSaleAttachmentFiles((prev) => [...prev, ...processed]);
                                                } finally {
                                                    setIsProcessingSaleAttachments(false);
                                                }
                                            })();
                                        }}
                                    >
                                        <Upload className="mx-auto mb-1 text-muted-foreground" size={20} />
                                        <p className="text-xs text-muted-foreground">{isProcessingSaleAttachments ? 'Compressing…' : 'Click or drop files (images, PDF)'}</p>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">Saved with sale when you save</p>
                                    </div>
                                </label>
                                {saleAttachmentFiles.length > 0 && (
                                    <div className="space-y-1.5 max-h-28 overflow-y-auto">
                                        {saleAttachmentFiles.map((file, idx) => (
                                            <div key={idx} className="flex items-center justify-between gap-2 bg-input-background rounded-md px-2.5 py-2 border border-border/50">
                                                <FileText size={14} className="text-muted-foreground shrink-0" />
                                                <span className="text-sm text-muted-foreground truncate flex-1 min-w-0">{file.name}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setSaleAttachmentFiles((prev) => prev.filter((_, i) => i !== idx))}
                                                    className="text-red-400 hover:text-red-300 shrink-0 p-0.5"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {savedSaleAttachments.length > 0 && (
                                    <div className="space-y-1.5 pt-1 border-t border-border">
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Saved with sale</p>
                                        <div className="space-y-1.5 max-h-24 overflow-y-auto">
                                            {savedSaleAttachments.map((att, idx) => (
                                                <div key={idx} className="flex items-center justify-between gap-2 bg-input-background rounded-md px-2.5 py-1.5 border border-border/50">
                                                    <FileText size={12} className="text-muted-foreground shrink-0" />
                                                    <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">{att.name || 'Attachment'}</span>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 text-xs text-blue-400 hover:text-blue-300 shrink-0"
                                                        onClick={async () => {
                                                            const { getAttachmentOpenUrl } = await import('@/app/utils/paymentAttachmentUrl');
                                                            const url = await getAttachmentOpenUrl(att.url);
                                                            window.open(url, '_blank');
                                                        }}
                                                    >
                                                        Open
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {(() => {
                                    const fromPayments = partialPayments.flatMap((p) => (p.attachments || []).map((a) => ({ ...a, paymentMethod: p.method })));
                                    return fromPayments.length > 0 ? (
                                        <div className="space-y-1.5 pt-1 border-t border-border">
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">From payments</p>
                                            <div className="space-y-1.5 max-h-24 overflow-y-auto">
                                                {fromPayments.map((att, idx) => (
                                                    <div key={idx} className="flex items-center justify-between gap-2 bg-input-background rounded-md px-2.5 py-1.5 border border-border/50">
                                                        <FileText size={12} className="text-muted-foreground shrink-0" />
                                                        <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">{att.name || 'Attachment'}</span>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-6 text-xs text-blue-400 hover:text-blue-300 shrink-0"
                                                            onClick={async () => {
                                                                const { getAttachmentOpenUrl } = await import('@/app/utils/paymentAttachmentUrl');
                                                                const url = await getAttachmentOpenUrl(att.url);
                                                                window.open(url, '_blank');
                                                            }}
                                                        >
                                                            Open
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : null;
                                })()}
                                {saleAttachmentFiles.length === 0 && partialPayments.flatMap((p) => p.attachments || []).length === 0 && savedSaleAttachments.length === 0 && (
                                    <p className="text-xs text-muted-foreground">No files yet. Add above; they'll be saved with the sale when you save.</p>
                                )}
                            </div>

                            {/* Invoice Summary – Grand Total, Due Balance */}
                            <div className="bg-muted/40 border border-border rounded-lg p-4 shrink-0">
                                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Invoice Summary</h3>
                                <div className="space-y-2">
                                {/* PART 1 & 2: Items Subtotal → Extra Expenses → Shipping Charges (visible line when charged_to_customer > 0) → Discount → Grand Total */}
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">Items Subtotal</span>
                                    <span className="text-foreground font-medium text-sm">{subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>

                                {expensesOnBill > 0 && (
                                    <div className="flex justify-between text-xs">
                                        <span className="text-purple-400">Extra Expenses</span>
                                        <span className="text-purple-400 font-medium text-sm">+{expensesOnBill.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                )}
                                {!chargeExtrasToCustomer && expensesTotal > 0 && (
                                    <div className="flex justify-between text-[10px] text-muted-foreground">
                                        <span>Package extras (4120, not on bill)</span>
                                        <span>Rs. {expensesTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                )}

                                {/* Shipping Charges: only when charged_to_customer > 0; optional subtext Courier / Tracking (PART 6) */}
                                {shipmentChargesFromApi > 0 && (
                                    <div className="flex justify-between text-xs items-start gap-2">
                                        <div className="min-w-0">
                                            <span className="text-blue-400 block">Shipping Charges</span>
                                            {saleShipments.length > 0 && (saleShipments[0].courierName || saleShipments[0].trackingId) && (
                                                <span className="text-[10px] text-muted-foreground block mt-0.5">
                                                    ({[saleShipments[0].courierName, saleShipments[0].trackingId ? `Tracking: ${saleShipments[0].trackingId}` : null].filter(Boolean).join(' – ')})
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-blue-400 font-medium text-sm shrink-0">+{shipmentChargesFromApi.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                )}

                                {/* Discount - Inline Input */}
                                <div className="flex items-center justify-between gap-2 py-1">
                                    <div className="flex items-center gap-1.5">
                                        <Percent size={12} className="text-red-400" />
                                        <span className="text-xs text-muted-foreground">Discount</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Select value={discountType} onValueChange={(v: any) => setDiscountType(v)}>
                                            <SelectTrigger className="w-14 h-8 bg-input-background border-border text-foreground text-xs px-2">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-input-background border-border text-foreground min-w-[60px]">
                                                <SelectItem value="percentage">%</SelectItem>
                                                <SelectItem value="fixed">{getCurrencySymbol(company?.currency)}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Input 
                                            type="number" 
                                            placeholder="0"
                                            className="w-20 h-8 bg-input-background border-border text-foreground text-xs text-right px-2"
                                            value={discountValue > 0 ? discountValue : ''}
                                            onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                                        />
                                        {discountAmount > 0 && (
                                            <span className="text-sm text-red-400 font-medium min-w-[60px] text-right">
                                                -{discountAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <Separator className="bg-muted" />

                                {paymentsLoading && (
                                    <p className="text-xs text-muted-foreground">Loading payment history…</p>
                                )}

                                {/* Payment history – same as Purchase */}
                                {partialPayments.length > 0 && (
                                    <>
                                        <div className="pt-1">
                                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                                                <Wallet size={14} />
                                                Payment history ({partialPayments.length})
                                            </h4>
                                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                                {partialPayments.map((p) => (
                                                    <div key={p.id} className="flex items-center justify-between gap-2 bg-input-background/80 rounded-md px-2.5 py-2 border border-border/50">
                                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                                            {p.method === 'cash' && <Banknote size={14} className="text-green-500 shrink-0" />}
                                                            {p.method === 'bank' && <CreditCard size={14} className="text-blue-500 shrink-0" />}
                                                            {p.method === 'Mobile Wallet' && <Wallet size={14} className="text-amber-500 shrink-0" />}
                                                            <span className="text-sm text-foreground capitalize truncate">{p.method}</span>
                                                            {(p.reference || p.notes || (p.attachments?.length ?? 0) > 0) && (
                                                                <span className="text-xs text-muted-foreground truncate">
                                                                    {p.reference && `Ref: ${p.reference}`}
                                                                    {p.reference && (p.notes || (p.attachments?.length ?? 0) > 0) && ' · '}
                                                                    {(p.attachments?.length ?? 0) > 0 && `${p.attachments!.length} file(s)`}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="text-base font-semibold text-[var(--erp-money-positive)] shrink-0 tabular-nums">{Number(p.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <Separator className="bg-muted" />
                                    </>
                                )}

                                <div className="flex justify-between items-center pt-1">
                                    <span className="text-sm font-semibold text-foreground">Grand Total</span>
                                    <span className="text-xl font-bold text-blue-500">{totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between items-center pt-1">
                                    <span className="text-sm font-semibold text-foreground">Due balance</span>
                                    <span className="text-xl font-semibold text-orange-500">{Math.max(0, balanceDue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>

                                {/* Salesman Commission - Info Only (not added to total) */}
                                {salesmanId !== "1" && (
                                    <>
                                        <Separator className="bg-muted/50" />
                                        <div className="pt-2 space-y-1.5">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-1.5">
                                                    <UserCheck size={12} className="text-[var(--erp-money-positive)]" />
                                                    <span className="text-xs text-muted-foreground">Commission</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <Select
                                                        value={commissionType}
                                                        onValueChange={(v: any) => setCommissionType(v)}
                                                        disabled={
                                                          !canAssignCommission &&
                                                          !!(salesmanId && salesmanId !== '1' && salesmanId !== 'none')
                                                        }
                                                    >
                                                        <SelectTrigger className="w-12 h-6 bg-input-background border-border text-foreground text-[10px] px-1">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent className="bg-input-background border-border text-foreground min-w-[60px]">
                                                            <SelectItem value="percentage">%</SelectItem>
                                                            <SelectItem value="fixed">{getCurrencySymbol(company?.currency)}</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <Input
                                                        type="number"
                                                        placeholder="0"
                                                        min={0}
                                                        className="w-16 h-6 bg-input-background border-border text-foreground text-xs text-right px-2"
                                                        value={commissionValue === 0 ? 0 : commissionValue}
                                                        onChange={(e) => setCommissionValue(parseFloat(e.target.value) || 0)}
                                                        disabled={
                                                          !canAssignCommission &&
                                                          !!(salesmanId && salesmanId !== '1' && salesmanId !== 'none')
                                                        }
                                                    />
                                                </div>
                                            </div>
                                            {commissionAmount > 0 && (
                                                <div className="text-xs text-[var(--erp-money-positive)] font-medium text-right bg-green-500/10 px-2 py-1 rounded">
                                                    Commission: {commissionAmount.toLocaleString()}
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>

            {/* ============ PAYMENT CHOICE DIALOG ============ */}
            <AlertDialog open={paymentChoiceDialogOpen} onOpenChange={setPaymentChoiceDialogOpen}>
                <AlertDialogContent className="bg-background border-border text-foreground max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-bold flex items-center gap-2">
                            <DollarSign size={20} className="text-blue-400" />
                            Payment Option
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground pt-2">
                            How would you like to handle payment for this sale?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-3 py-4">
                        <Button
                            onClick={async () => {
                                setPaymentChoiceDialogOpen(false);
                                const printFlag = pendingSaveAction?.print || false;
                                setPendingSaveAction(null);
                                
                                try {
                                    // Save first, then open payment dialog
                                    // Pass shouldOpenPaymentDialog=true so form doesn't close
                                    const result = await proceedWithSave(printFlag, true);
                                    if (!result) {
                                        // proceedWithSave already showed the real error in its catch
                                        return;
                                    }
                                    if ((result as any)?.studioRedirect) {
                                        toast.success('Sale saved. Add payment from the sale detail if needed.');
                                        return;
                                    }
                                    // If sale was created/updated, open payment dialog
                                    if (result.saleId) {
                                        console.log('[SALE FORM] ✅ Sale saved, opening payment dialog:', {
                                            saleId: result.saleId,
                                            invoiceNo: result.invoiceNo
                                        });
                                        setSavedSaleId(result.saleId);
                                        setSavedSaleInvoiceNo(result.invoiceNo);
                                        setUnifiedPaymentDialogOpen(true);
                                    } else {
                                        console.warn('[SALE FORM] ⚠️ Sale saved but no saleId returned');
                                        toast.error('Sale saved but could not open payment dialog. Please add payment manually.');
                                    }
                                } catch (error) {
                                    console.error('[SALE FORM] Error saving sale for payment:', error);
                                    toast.error('Failed to save sale. Please try again.');
                                }
                            }}
                            className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white text-base font-semibold flex items-center justify-center gap-2"
                        >
                            <DollarSign size={20} />
                            Pay Now
                        </Button>
                        <Button
                            onClick={async () => {
                                setPaymentChoiceDialogOpen(false);
                                if (pendingSaveAction) {
                                    await proceedWithSave(pendingSaveAction.print);
                                }
                                setPendingSaveAction(null);
                            }}
                            className="w-full h-14 bg-muted hover:bg-gray-600 text-foreground text-base font-semibold flex items-center justify-center gap-2"
                        >
                            <CreditCard size={20} />
                            Credit Bill (Save without payment)
                        </Button>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel 
                            onClick={() => {
                                setPendingSaveAction(null);
                            }}
                            className="bg-muted hover:bg-accent text-foreground border-border"
                        >
                            Cancel
                        </AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ============ UNIFIED PAYMENT DIALOG ============ */}
            <UnifiedPaymentDialog
                isOpen={unifiedPaymentDialogOpen && !!savedSaleId}
                onClose={() => {
                    setUnifiedPaymentDialogOpen(false);
                    setSavedSaleId(null);
                    setSavedSaleInvoiceNo(null);
                    onClose(); // Close sale form after payment
                }}
                context="customer"
                entityName={customers.find(c => c.id.toString() === customerId)?.name || 'Customer'}
                entityId={customerId === 'walk-in' ? undefined : customerId.toString()}
                outstandingAmount={totalAmount}
                totalAmount={totalAmount}
                paidAmount={0}
                previousPayments={[]}
                referenceNo={savedSaleInvoiceNo || undefined}
                referenceId={savedSaleId || undefined}
                customerBillRef={refNumber.trim() || undefined}
                onSuccess={() => {
                    console.log('[SALE FORM] ✅ Payment saved successfully, refreshing sales list');
                    setUnifiedPaymentDialogOpen(false);
                    setSavedSaleId(null);
                    setSavedSaleInvoiceNo(null);
                    setSaleAttachmentFiles([]);
                    if (customerId && customerId !== 'walk-in') {
                        window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'customer', entityId: customerId } }));
                    }
                    onClose();
                }}
            />

            {/* Reusable Shipment Modal (PART 3) – same component as Sales list 3-dot Add Shipment */}
            {showShipmentModal && initialSale?.id && companyId && branchId && (
                <ShipmentModal
                    open={true}
                    onClose={() => { setShowShipmentModal(false); setEditingShipmentId(null); }}
                    saleId={initialSale.id}
                    companyId={companyId}
                    branchId={branchId}
                    invoiceNo={displayInvoiceNumber ?? undefined}
                    editingShipment={editingShipmentId && saleShipments.length > 0 ? {
                        id: saleShipments[0].id,
                        shipmentType: saleShipments[0].shipmentType,
                        courierMasterId: saleShipments[0].courierMasterId,
                        courierName: saleShipments[0].courierName,
                        weight: saleShipments[0].weight,
                        chargedToCustomer: saleShipments[0].chargedToCustomer,
                        actualCost: saleShipments[0].actualCost,
                        trackingId: saleShipments[0].trackingId,
                        shipmentStatus: saleShipments[0].shipmentStatus,
                        notes: saleShipments[0].notes,
                    } : null}
                    initialChargedToCustomer={shippingChargeInput}
                    onSaved={async () => {
                        if (!initialSale?.id) return;
                        const rows = await shipmentService.getBySaleId(initialSale.id);
                        setSaleShipments(mapShipmentRowsToUi(rows));
                    }}
                    performedBy={user?.id}
                />
            )}

            {/* ============ LAYER 3: FIXED FOOTER ============ */}
            <div className="shrink-0 bg-popover border-t border-border">
                {/* No-branch-assignment warning: only when multi-branch and user has no mapping */}
                {!isAdmin && requiresBranchSelection && (
                    <div className="px-6 py-2 bg-red-950/50 border-b border-red-900/50 flex items-center gap-2 text-red-200 text-sm">
                        <span className="font-medium">Your user is not assigned to any branch.</span>
                        <span>Ask admin to assign a branch so you can save sales.</span>
                    </div>
                )}
                {/* Totals Summary Row */}
                <div className="h-10 flex items-center justify-between px-6 border-b border-border/50 bg-input-background/30">
                    <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground">
                        {/* Items Count */}
                        <span className="font-medium">{items.length} Items</span>
                        <span className="w-0.5 h-0.5 rounded-full bg-gray-600" />
                        
                        {/* Total Quantity */}
                        <span>Qty: <span className="font-semibold text-foreground">{items.reduce((sum, item) => sum + item.qty, 0).toLocaleString()}</span></span>
                        
                        {/* Packing Summary - Only show non-zero values */}
                        {enablePacking && items.some(item => item.packingDetails) && (() => {
                            const totalBoxes = items.reduce((sum, item) => sum + (item.packingDetails?.total_boxes || 0), 0);
                            const totalPieces = items.reduce((sum, item) => sum + (item.packingDetails?.total_pieces || 0), 0);
                            const totalMeters = items.reduce((sum, item) => sum + (item.packingDetails?.total_meters || 0), 0);
                            const parts = [];
                            if (totalBoxes > 0) parts.push(<span key="box">Box: <span className="font-semibold text-foreground">{totalBoxes}</span></span>);
                            if (totalPieces > 0) parts.push(<span key="pcs">Pcs: <span className="font-semibold text-foreground">{totalPieces}</span></span>);
                            if (totalMeters > 0) parts.push(<span key="mtr">Mtr: <span className="font-semibold text-foreground">{totalMeters.toLocaleString()}</span></span>);
                            return parts.length > 0 ? (
                                <span className="flex items-center gap-2">
                                    <span className="w-0.5 h-0.5 rounded-full bg-gray-600" />
                                    {parts.map((part, i) => (
                                        <span key={i} className="contents">
                                            {part}
                                            {i < parts.length - 1 && <span className="text-muted-foreground">|</span>}
                                        </span>
                                    ))}
                                </span>
                            ) : null;
                        })()}
                        
                        <span className="w-0.5 h-0.5 rounded-full bg-gray-600" />
                        
                        {/* Grand Total */}
                        <span className="text-xs font-bold text-[var(--erp-money-positive)]">Total: {totalAmount.toLocaleString()}</span>
                    </div>
                </div>

                {/* Action Buttons Row - FIXED 2 BUTTONS ONLY */}
                <div className="h-14 px-6 flex items-center justify-center">
                    <div className="invoice-container mx-auto w-full">
                        <div className="flex gap-3 justify-center">
                            <Button 
                                type="button"
                                variant="outline"
                                className="h-10 bg-transparent border border-border hover:border-gray-600 hover:bg-accent text-foreground text-sm font-semibold"
                                onClick={() => handleSave(false)}
                                disabled={saving || (needsConvertHydration && !convertHydrationReady)}
                            >
                                <Save size={15} className="mr-1.5" />
                                {needsConvertHydration && !convertHydrationReady
                                    ? 'Loading order…'
                                    : saving
                                        ? (initialSale ? 'Updating...' : 'Saving...')
                                        : (initialSale ? 'Update' : 'Save')}
                            </Button>
                            <Button 
                                type="button"
                                className="h-10 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold shadow-lg shadow-blue-900/20"
                                onClick={() => handleSave(true)}
                                disabled={saving || (needsConvertHydration && !convertHydrationReady)}
                            >
                                <Printer size={15} className="mr-1.5" />
                                {needsConvertHydration && !convertHydrationReady
                                    ? 'Loading order…'
                                    : saving
                                        ? (initialSale ? 'Updating...' : 'Saving...')
                                        : (initialSale ? 'Update & Print' : 'Save & Print')}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Hidden - Old Footer (Replaced by Sticky Action Bar) */}
            <div className="hidden h-16 shrink-0 bg-popover border-t border-border flex items-center justify-between px-6">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {/* Items Count */}
                    <span>{items.length} Items</span>
                    <span className="w-1 h-1 rounded-full bg-gray-600" />
                    
                    {/* Total Quantity */}
                    <span>Qty: {items.reduce((sum, item) => sum + item.qty, 0).toLocaleString()}</span>
                    
                    {/* Packing Summary - Only when Enable Packing is ON and at least one item has packing */}
                    {enablePacking && items.some(item => item.packingDetails) && (
                        <>
                            <span className="w-1 h-1 rounded-full bg-gray-600" />
                            <span>
                                Box: {items.reduce((sum, item) => sum + (item.packingDetails?.total_boxes || 0), 0)} | 
                                Pcs: {items.reduce((sum, item) => sum + (item.packingDetails?.total_pieces || 0), 0)} | 
                                Mtr: {items.reduce((sum, item) => sum + (item.packingDetails?.total_meters || 0), 0).toLocaleString()}
                            </span>
                        </>
                    )}
                    
                    <span className="w-1 h-1 rounded-full bg-gray-600" />
                    
                    {/* Grand Total */}
                    <span>Total: {totalAmount.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" onClick={onClose} className="border-border text-muted-foreground h-10">
                        Cancel
                    </Button>
                    <Button 
                        className="bg-blue-600 hover:bg-blue-500 text-white h-10 gap-2"
                        onClick={() => toast.success("Sale saved!")}
                    >
                        <Save size={16} />
                        Save
                    </Button>
                    <Button 
                        className="bg-blue-600 hover:bg-blue-500 text-white h-10 gap-2"
                        onClick={() => toast.success("Sale saved and printing!")}
                    >
                        <Printer size={16} />
                        Save & Print
                    </Button>
                </div>
            </div>

            {/* Print Layout Modal - after Save & Print */}
            {showPrintLayout && saleForPrint && companyId && (
                <div className="fixed inset-0 z-[100] bg-[var(--erp-overlay)] flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
                        <UnifiedSalesInvoiceView
                            saleId={saleForPrint.id}
                            companyId={companyId}
                            templateType="A4"
                            onClose={() => {
                                setShowPrintLayout(false);
                                setSaleForPrint(null);
                                onClose();
                            }}
                            showPrintAction={true}
                        />
                    </div>
                </div>
            )}

            {/* Packing Modal - Now rendered globally in GlobalDrawer */}

            {enableBespoke && companyId && (
                <BespokeDetailsModal
                    open={bespokeItemId != null}
                    onOpenChange={(open) => { if (!open) setBespokeItemId(null); }}
                    productName={items.find((i) => i.id === bespokeItemId)?.name}
                    config={bespokeFormConfig}
                    initial={items.find((i) => i.id === bespokeItemId)?.customizationDetails}
                    initialFabrics={
                        bespokeItemId != null
                            ? hydrateFabricDraftsFromChildren(bespokeItemId, items)
                            : undefined
                    }
                    companyId={companyId}
                    branchId={branchId && branchId !== 'all' ? branchId : contextBranchId}
                    onSave={(payload) => {
                        if (bespokeItemId != null) handleSaveBespoke(bespokeItemId, payload);
                    }}
                />
            )}
        </div>
    );
};
