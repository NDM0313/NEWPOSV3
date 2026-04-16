import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  Plus, ShoppingCart, DollarSign, TrendingUp, 
  MoreVertical, Eye, Edit, Trash2, FileText, Phone, MapPin,
  Package, Truck, CheckCircle, CheckCircle2, Clock, XCircle, AlertCircle,
  UserCheck, Receipt, Loader2, PackageCheck, PackageX, ChevronDown, ChevronUp,
  RotateCcw, Paperclip, X, Zap, Store, Printer, Download, Share2, Scissors
} from 'lucide-react';
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/app/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/app/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/app/components/ui/dialog";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { cn } from "@/app/components/ui/utils";
import { useNavigation } from '@/app/context/NavigationContext';
import { useSales, Sale, convertFromSupabaseSale } from '@/app/context/SalesContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useSettings } from '@/app/context/SettingsContext';
import { BulkInvoiceWorkflow } from '@/app/wholesale';
import { QuotationWorkflow } from './QuotationWorkflow';
import { useGlobalFilter } from '@/app/context/GlobalFilterContext';
import { saleService } from '@/app/services/saleService';
import { supabase } from '@/lib/supabase';
import { branchService, Branch } from '@/app/services/branchService';
import { saleReturnService } from '@/app/services/saleReturnService';
import { shipmentService } from '@/app/services/shipmentService';
import { Pagination } from '@/app/components/ui/pagination';
import { ListToolbar } from '@/app/components/ui/list-toolbar';
import { formatLongDate, formatDateAndTime } from '@/app/components/ui/utils';
import { UnifiedPaymentDialog } from '@/app/components/shared/UnifiedPaymentDialog';
import { UnifiedLedgerView } from '@/app/components/shared/UnifiedLedgerView';
import { ViewSaleDetailsDrawer } from './ViewSaleDetailsDrawer';
import { ShipmentHistoryDrawer } from './ShipmentHistoryDrawer';
import { ShipmentModal } from './ShipmentModal';
import type { InvoiceTemplateType } from '@/app/types/invoiceDocument';
import { SaleReturnForm } from './SaleReturnForm';
import { StandaloneSaleReturnForm } from './StandaloneSaleReturnForm';
import { ReturnPaymentAdjustment } from './ReturnPaymentAdjustment';
import { ViewPaymentsModal, type InvoiceDetails, type Payment } from './ViewPaymentsModal';
import { AttachmentViewer } from '@/app/components/shared/AttachmentViewer';
import { SaleReturnPrintLayout } from '@/app/components/shared/SaleReturnPrintLayout';
import { toast } from 'sonner';
import { exportToCSV, exportToExcel, exportToPDF, type ExportData } from '@/app/utils/exportUtils';
import { useCheckPermission } from '@/app/hooks/useCheckPermission';
import { getEffectiveSaleStatus, getSaleStatusBadgeConfig, DEFAULT_SALE_BADGE, isPaymentClosedForSale, canAddPaymentToSale } from '@/app/utils/statusHelpers';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { getSaleDisplayNumber } from '@/app/lib/documentDisplayNumbers';
import { transitionSaleLifecycle, restoreSaleFromCancelled } from '@/app/lib/documentLifecycleActions';
import { SaleLifecycleMenuBlock, type SaleLifecycleAction } from '@/app/components/sales/SaleLifecycleMenuBlock';

/** Shipment / freight charged to customer (trigger-synced `shipment_charges` on sale). Matches ViewSaleDetailsDrawer. */
function getSaleShippingChargesAmount(sale: Sale): number {
  return Number(sale.shippingCharges ?? sale.expenses ?? (sale as { shipment_charges?: number }).shipment_charges) || 0;
}

/** Invoice amount before payments: product total + shipment to customer + studio (when applicable). */
function getSaleBillableAmount(sale: Sale): number {
  return (sale.total ?? 0) + getSaleShippingChargesAmount(sale) + (Number(sale.studioCharges ?? 0) || 0);
}

/** List search: invoice / customer / branch / notes (includes optional REF #) / stage numbers / line SKU or product name. */
function saleMatchesSearchTerm(sale: Sale, raw: string): boolean {
  const search = raw.trim().toLowerCase();
  if (!search) return true;
  const fields = [
    sale.invoiceNo,
    sale.customer,
    sale.customerName,
    sale.contactNumber || '',
    sale.location || '',
    (sale as Sale & { draftNo?: string }).draftNo,
    (sale as Sale & { quotationNo?: string }).quotationNo,
    (sale as Sale & { orderNo?: string }).orderNo,
    (sale as Sale & { notes?: string }).notes,
  ];
  if (fields.some((f) => String(f || '').toLowerCase().includes(search))) return true;
  const items = sale.items || [];
  for (const it of items as Array<{ sku?: string; productName?: string; name?: string }>) {
    const sku = String(it.sku || '').toLowerCase();
    const name = String(it.productName || it.name || '').toLowerCase();
    if (sku.includes(search) || name.includes(search)) return true;
  }
  return false;
}

// Mock data removed - using SalesContext which loads from Supabase

export const SalesPage = () => {
  const { openDrawer, setCurrentView, openSaleIdForView, setOpenSaleIdForView } = useNavigation();
  const { canEditSale, canDeleteSale, canCancelSale, canCreateSale } = useCheckPermission();
  const { formatCurrency } = useFormatCurrency();
  const { sales, deleteSale, updateSale, recordPayment, updateShippingStatus, refreshSales, loading, totalCount, page, pageSize: contextPageSize, setPage } = useSales();
  const { companyId, branchId, user } = useSupabase();
  const { company } = useSettings();
  const globalFilter = useGlobalFilter();
  const { startDate, endDate, setCurrentModule } = globalFilter;

  useEffect(() => {
    setCurrentModule('sales');
  }, [setCurrentModule]);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchMap, setBranchMap] = useState<Map<string, string>>(new Map());
  
  // Bulk selection removed - using single-row actions only
  
  // Store branch_id mapping for sales (for location resolution when location is empty)
  const [salesBranchIdMap, setSalesBranchIdMap] = useState<Map<string, string>>(new Map());
  const [showBulkInvoiceWorkflow, setShowBulkInvoiceWorkflow] = useState(false);
  const [showQuotationWorkflow, setShowQuotationWorkflow] = useState(false);
  
  // Load branches for location display
  useEffect(() => {
    const loadBranches = async () => {
      if (!companyId) return;
      try {
        const branchesData = await branchService.getAllBranches(companyId);
        setBranches(branchesData);
        // Create mapping from branch_id to branch NAME only (UI rule: no code, no UUID)
        const map = new Map<string, string>();
        branchesData.forEach(branch => {
          map.set(branch.id, branch.name);
        });
        setBranchMap(map);
        console.log('[SALES PAGE] ✅ Branch map loaded:', map.size, 'branches');
      } catch (error) {
        console.error('[SALES PAGE] Error loading branches:', error);
      }
    };
    loadBranches();
  }, [companyId]);
  
  // Load sales with branch_id for location resolution (only when sales change)
  useEffect(() => {
    const loadSalesBranchIds = async () => {
      if (!companyId || sales.length === 0) return;
      try {
        // Fetch sales with branch_id to create mapping
        const data = await saleService.getAllSales(companyId, branchId === 'all' ? undefined : branchId || undefined);
        const branchIdMap = new Map<string, string>();
        data.forEach((sale: any) => {
          if (sale.branch_id && sale.id) {
            branchIdMap.set(sale.id, sale.branch_id);
          }
        });
        setSalesBranchIdMap(branchIdMap);
        console.log('[SALES PAGE] ✅ Sales branch_id map loaded:', branchIdMap.size, 'sales');
      } catch (error) {
        console.error('[SALES PAGE] Error loading sales branch_ids:', error);
      }
    };
    // Only load if we have sales but no branch_id mapping yet, or if sales count changed
    if (sales.length > 0 && (salesBranchIdMap.size === 0 || salesBranchIdMap.size !== sales.length)) {
      loadSalesBranchIds();
    }
  }, [companyId, branchId, sales.length]);

  // Track which sales have returns
  const [salesWithReturns, setSalesWithReturns] = useState<Set<string>>(new Set());

  // Load sales with returns
  useEffect(() => {
    const loadSalesWithReturns = async () => {
      if (!companyId || sales.length === 0) return;
      try {
        const returns = await saleReturnService.getSaleReturns(companyId, branchId === 'all' ? undefined : branchId || undefined);
        const saleIdsWithReturns = new Set<string>();
        returns.forEach((ret: any) => {
          if (ret.original_sale_id && String(ret.status).toLowerCase() === 'final') {
            saleIdsWithReturns.add(ret.original_sale_id);
          }
        });
        setSalesWithReturns(saleIdsWithReturns);
        console.log('[SALES PAGE] ✅ Sales with returns loaded:', saleIdsWithReturns.size, 'returns found');
        console.log('[SALES PAGE] Sale IDs with returns:', Array.from(saleIdsWithReturns));
        console.log('[SALES PAGE] Current sales IDs:', sales.map(s => s.id));
      } catch (error) {
        console.error('[SALES PAGE] Error loading sales with returns:', error);
      }
    };
    loadSalesWithReturns();
  }, [companyId, branchId, sales.length]);

  // 🎯 Listen for payment added event to refresh sales list
  useEffect(() => {
    const handlePaymentAdded = async () => {
      console.log('[SALES PAGE] Payment added event received, refreshing sales list...');
      await refreshSales();
    };

    window.addEventListener('paymentAdded', handlePaymentAdded);
    return () => {
      window.removeEventListener('paymentAdded', handlePaymentAdded);
    };
  }, [refreshSales]);
  
  // 🎯 Payment Dialog & Ledger states
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [viewDetailsOpen, setViewDetailsOpen] = useState(false);
  const [invoicePrintType, setInvoicePrintType] = useState<InvoiceTemplateType | null>(null);
  
  // 🎯 View Payments Modal state
  const [viewPaymentsOpen, setViewPaymentsOpen] = useState(false);
  // Edit payment: when set, UnifiedPaymentDialog opens in edit mode
  const [paymentToEdit, setPaymentToEdit] = useState<any>(null);
  
  // 🎯 NEW: Additional dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [shippingDialogOpen, setShippingDialogOpen] = useState(false);
  const [saleReturnFormOpen, setSaleReturnFormOpen] = useState(false);
  const [saleReturnSaleId, setSaleReturnSaleId] = useState<string | null>(null);
  /** When set, SaleReturnForm opens in edit mode for this return (draft only). */
  const [saleReturnEditId, setSaleReturnEditId] = useState<string | null>(null);
  /** Standalone sale return (no invoice) form */
  const [standaloneReturnFormOpen, setStandaloneReturnFormOpen] = useState(false);
  const [returnPaymentDialogOpen, setReturnPaymentDialogOpen] = useState(false);
  const [returnPaymentSaleId, setReturnPaymentSaleId] = useState<string | null>(null);
  const [cancelInvoiceDialogOpen, setCancelInvoiceDialogOpen] = useState(false);
  const [cancellingInvoice, setCancellingInvoice] = useState(false);
  const [cancelDeductShipping, setCancelDeductShipping] = useState(true);

  // Add Shipment modal (from row dropdown) – uses shared ShipmentModal (PART 3, PART 4)
  const [addShipmentSaleId, setAddShipmentSaleId] = useState<string | null>(null);
  
  // State for viewing sale returns
  const [viewReturnsDialogOpen, setViewReturnsDialogOpen] = useState(false);
  const [selectedSaleForReturns, setSelectedSaleForReturns] = useState<Sale | null>(null);
  const [saleReturns, setSaleReturns] = useState<any[]>([]);
  const [loadingReturns, setLoadingReturns] = useState(false);
  
  // State for viewing attachments
  const [attachmentsDialogList, setAttachmentsDialogList] = useState<{ url: string; name: string }[] | null>(null);
  
  // Tab state - All, POS, Regular, Returns, Quotation, Final
  const [activeTab, setActiveTab] = useState<'all' | 'pos' | 'regular' | 'returns' | 'quotation' | 'final'>('all');
  
  // Return details dialog state
  const [selectedReturn, setSelectedReturn] = useState<any | null>(null);
  const [viewReturnDetailsOpen, setViewReturnDetailsOpen] = useState(false);
  const [deleteReturnDialogOpen, setDeleteReturnDialogOpen] = useState(false);
  const [returnToDelete, setReturnToDelete] = useState<any | null>(null);
  const [voidReturnDialogOpen, setVoidReturnDialogOpen] = useState(false);
  const [returnToVoid, setReturnToVoid] = useState<any | null>(null);
  const [voidingReturn, setVoidingReturn] = useState(false);
  const [selectedReturnForPrint, setSelectedReturnForPrint] = useState<any | null>(null);
  const [printReturnOpen, setPrintReturnOpen] = useState(false);

  // Shipment History drawer (opened from shipping status icon)
  const [shipmentHistoryDrawerOpen, setShipmentHistoryDrawerOpen] = useState(false);
  const [shipmentHistoryShipmentId, setShipmentHistoryShipmentId] = useState<string | null>(null);
  const [shipmentHistoryInvoiceNo, setShipmentHistoryInvoiceNo] = useState<string>('');

  // Update Shipping modal: form state and loaded shipment
  const SHIPMENT_STATUS_OPTIONS = ['Booked', 'Picked', 'In Transit', 'Out for Delivery', 'Delivered', 'Returned', 'Cancelled'] as const;
  const [updateShippingForm, setUpdateShippingForm] = useState({ courierName: '', trackingId: '', shipmentStatus: 'Booked' as string });
  const [updateShippingSaving, setUpdateShippingSaving] = useState(false);
  const [updateShippingLoadedShipmentId, setUpdateShippingLoadedShipmentId] = useState<string | null>(null);

  // Filter states
  const [dateFilter, setDateFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');

  // Check for customer filter from ContactsPage
  useEffect(() => {
    const customerId = sessionStorage.getItem('salesFilter_customerId');
    const customerName = sessionStorage.getItem('salesFilter_customerName');
    if (customerId) {
      setCustomerFilter(customerId);
      sessionStorage.removeItem('salesFilter_customerId');
      sessionStorage.removeItem('salesFilter_customerName');
      if (customerName) {
        toast.info(`Filtering sales for ${customerName}`);
      }
    }
  }, []);

  // Load shipment when Update Shipping modal opens (populate Courier, Tracking, Status)
  useEffect(() => {
    if (!shippingDialogOpen || !selectedSale?.firstShipmentId) {
      if (!shippingDialogOpen) setUpdateShippingLoadedShipmentId(null);
      return;
    }
    const sid = selectedSale.firstShipmentId;
    if (updateShippingLoadedShipmentId === sid) return;
    shipmentService.getById(sid).then((row) => {
      if (row) {
        setUpdateShippingForm({
          courierName: row.courier_name ?? '',
          trackingId: row.tracking_id ?? '',
          shipmentStatus: row.shipment_status ?? 'Booked',
        });
        setUpdateShippingLoadedShipmentId(sid);
      }
    }).catch(() => setUpdateShippingLoadedShipmentId(null));
  }, [shippingDialogOpen, selectedSale?.firstShipmentId, updateShippingLoadedShipmentId]);

  // Open sale details drawer when navigated here with openSaleIdForView (e.g. after Generate Sale Invoice from Studio)
  // Refresh sales list first so the new SL invoice appears in the table, then open drawer
  useEffect(() => {
    if (!openSaleIdForView || !setOpenSaleIdForView) return;
    let cancelled = false;
    const run = async () => {
      await refreshSales();
      if (cancelled) return;
      try {
        const full = await saleService.getSaleById(openSaleIdForView);
        if (cancelled) return;
        const saleWithItems = convertFromSupabaseSale(full);
        setSelectedSale(saleWithItems);
        setViewDetailsOpen(true);
      } catch (_) {}
      if (!cancelled && setOpenSaleIdForView) setOpenSaleIdForView(null);
    };
    run();
    return () => { cancelled = true; };
  }, [openSaleIdForView, setOpenSaleIdForView, refreshSales]);

  /** Open a specific sale return from Accounting → “Open source” on a sale_return journal row. */
  useEffect(() => {
    if (typeof window === 'undefined' || !companyId) return;
    const pendingId = sessionStorage.getItem('pendingAccountingOpen_saleReturnId');
    if (!pendingId) return;
    sessionStorage.removeItem('pendingAccountingOpen_saleReturnId');
    let cancelled = false;
    void (async () => {
      try {
        const full = await saleReturnService.getSaleReturnById(pendingId, companyId);
        if (cancelled || !full) return;
        setActiveTab('returns');
        setSelectedReturn(full);
        setViewReturnDetailsOpen(true);
        toast.info(`Opened return ${full.return_no || full.id?.slice(0, 8)} — manage void/cancel from here.`);
      } catch {
        toast.error('Could not open sale return from journal link.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | PaymentStatus>('all');
  const [saleStatusFilter, setSaleStatusFilter] = useState<'all' | 'draft' | 'quotation' | 'order' | 'final' | 'cancelled'>('all');
  const [shippingStatusFilter, setShippingStatusFilter] = useState<'all' | ShippingStatus>('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  
  // 🎯 UNIFIED ACTION HANDLER
  const handleSaleAction = async (action: string, sale: Sale) => {
    setSelectedSale(sale);
    
    switch (action) {
      case 'view_details':
        setViewDetailsOpen(true);
        break;
        
      case 'edit':
        // 🔒 LOCK CHECK: Prevent editing if sale has returns
        if (sale.hasReturn || salesWithReturns.has(sale.id)) {
          toast.error('Cannot edit sale: This sale has a return and is locked. Returns cannot be edited or deleted.');
          return;
        }
        // Fetch full sale with items so Edit form shows line items (not just payments)
        try {
          const full = await saleService.getSaleById(sale.id);
          // Double check: backend should also return hasReturn
          if (full.hasReturn) {
            toast.error('Cannot edit sale: This sale has a return and is locked.');
            return;
          }
          const saleWithItems = convertFromSupabaseSale(full);
          openDrawer('edit-sale', undefined, { sale: saleWithItems });
        } catch (e: any) {
          console.error('[SalesPage] Error loading sale for edit:', e);
          if (e.message?.includes('return') || e.message?.includes('locked')) {
            toast.error(e.message);
          } else {
            toast.error('Could not load sale details');
          }
        }
        break;
        
      case 'print_invoice':
      case 'print_a4':
        setSelectedSale(sale);
        setInvoicePrintType('A4');
        setViewDetailsOpen(true);
        saleService.logPrint(sale.id, 'A4', user?.id).catch(() => {});
        break;
      case 'print_thermal':
        setSelectedSale(sale);
        setInvoicePrintType('Thermal');
        setViewDetailsOpen(true);
        saleService.logPrint(sale.id, 'Thermal', user?.id).catch(() => {});
        break;
      case 'share_whatsapp': {
        const due = getEffectiveDue(sale);
        const total = getSaleBillableAmount(sale);
        const baseUrl = window.location.origin + (import.meta.env?.BASE_URL || '');
        const link = `${baseUrl}/sales?invoice=${encodeURIComponent(sale.id)}`;
        const text = [
          `Invoice: ${sale.invoiceNo}`,
          `Customer: ${sale.customerName || 'Walk-in'}`,
          `Total: Rs. ${total.toLocaleString()}`,
          `Balance Due: Rs. ${due.toLocaleString()}`,
          `View: ${link}`,
        ].join('\n');
        saleService.logShare(sale.id, 'whatsapp', user?.id).catch(() => {});
        saleService.logSaleAction(sale.id, 'share_whatsapp', user?.id).catch(() => {});
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
        toast.success('WhatsApp share opened');
        break;
      }
      case 'share_pdf':
        setSelectedSale(sale);
        setInvoicePrintType('A4');
        setViewDetailsOpen(true);
        saleService.logShare(sale.id, 'pdf', user?.id).catch(() => {});
        saleService.logSaleAction(sale.id, 'share_pdf', user?.id).catch(() => {});
        break;
      case 'download_pdf':
        setSelectedSale(sale);
        setInvoicePrintType('A4');
        setViewDetailsOpen(true);
        saleService.logSaleAction(sale.id, 'download_pdf', user?.id).catch(() => {});
        break;
        
      case 'view_payments':
        setViewPaymentsOpen(true);
        break;
        
      case 'receive_payment':
        if (!canAddPaymentToSale(sale, getEffectiveDue(sale))) {
          const effective = getEffectiveSaleStatus(sale);
          if (effective === 'cancelled') toast.error('Cannot add payment to a cancelled invoice.');
          else if (effective === 'returned') toast.error('Invoice is fully returned; no payment allowed.');
          else toast.error('Cannot add payment.');
          return;
        }
        setPaymentDialogOpen(true);
        break;
      
      case 'cancel_invoice': {
        // Fetch return info BEFORE opening dialog so it shows immediately
        const fetchAndOpenCancel = async () => {
          if (selectedSale && companyId) {
            const { data: rets } = await supabase.from('sale_returns').select('id, total, discount_amount, status')
              .eq('original_sale_id', selectedSale.id).neq('status', 'void');
            const returnTotal = (rets || []).reduce((s: number, r: any) => s + (Number(r.total) || 0), 0);
            const returnDiscount = (rets || []).reduce((s: number, r: any) => s + (Number(r.discount_amount) || 0), 0);
            setSelectedSale(prev => prev ? { ...prev, returnTotal, returnDiscount } as any : prev);
          }
          setCancelInvoiceDialogOpen(true);
        };
        fetchAndOpenCancel();
        break;
      }
        
      case 'view_ledger':
        setLedgerOpen(true);
        break;
        
      case 'create_return':
        setSaleReturnSaleId(sale.id);
        setSaleReturnEditId(null);
        setSaleReturnFormOpen(true);
        break;
        
      case 'return_payment':
        setReturnPaymentSaleId(sale.id);
        setReturnPaymentDialogOpen(true);
        break;
        
      case 'update_shipping':
        setShippingDialogOpen(true);
        break;

      case 'add_shipment':
        setAddShipmentSaleId(sale.id);
        break;

      case 'convert_to_final':
        if (sale.status === 'final') {
          toast.info('Sale is already final.');
          return;
        }
        if (getEffectiveSaleStatus(sale) === 'cancelled') {
          toast.error('Cannot finalize a cancelled sale.');
          return;
        }
        // Open sale form with draft data; on Save → new invoice is created and draft is deleted (correct flow)
        try {
          const full = await saleService.getSaleById(sale.id);
          if (full.hasReturn) {
            toast.error('Cannot convert: this sale has a return and is locked.');
            return;
          }
          const saleWithItems = convertFromSupabaseSale(full);
          openDrawer('edit-sale', undefined, { sale: saleWithItems, convertToFinal: true });
        } catch (e: any) {
          console.error('[SalesPage] Error loading sale for convert to final:', e);
          toast.error(e?.message || 'Could not open sale form');
        }
        break;
        
      case 'delete':
        setDeleteDialogOpen(true);
        break;
        
      default:
        console.warn('Unknown action:', action);
        toast.error('Unknown action');
    }
  };

  const runSaleLifecycleFromUi = async (sale: Sale, action: SaleLifecycleAction) => {
    if (action === 'restore_draft' || action === 'restore_quotation' || action === 'restore_order') {
      if (!companyId) {
        toast.error('No company selected');
        return;
      }
      const target =
        action === 'restore_draft' ? 'draft' : action === 'restore_quotation' ? 'quotation' : 'order';
      try {
        await restoreSaleFromCancelled(sale.id, target, companyId);
        toast.success('Sale restored — you can edit and convert to final when ready.');
        await refreshSales();
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Restore failed');
      }
      return;
    }
    if (action === 'lifecycle_final') {
      await handleSaleAction('convert_to_final', sale);
      return;
    }
    if (action === 'lifecycle_cancel') {
      setSelectedSale(sale);
      setCancelInvoiceDialogOpen(true);
      return;
    }
    if (!companyId) {
      toast.error('No company selected');
      return;
    }
    const map: Partial<
      Record<SaleLifecycleAction, import('@/app/lib/documentLifecycleActions').SaleLifecycleTarget>
    > = {
      lifecycle_draft: 'draft',
      lifecycle_quotation: 'quotation',
      lifecycle_order: 'order',
    };
    const target = map[action];
    if (!target) return;
    try {
      await transitionSaleLifecycle(sale.id, target, companyId);
      toast.success('Sale status updated');
      await refreshSales();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not update status');
    }
  };
  
  // 🎯 DELETE HANDLER
  const handleDelete = async () => {
    if (!selectedSale) return;
    
    try {
      await deleteSale(selectedSale.id);
      toast.success(`Sale ${selectedSale.invoiceNo} deleted successfully`);
      setDeleteDialogOpen(false);
      setSelectedSale(null);
      await refreshSales();
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error(error.message || 'Failed to delete sale');
    }
  };

  // 🎯 CANCEL INVOICE HANDLER
  const handleCancelInvoice = async () => {
    if (!selectedSale) return;
    setCancellingInvoice(true);
    try {
      const shippingToDeduct = cancelDeductShipping ? (Number((selectedSale as any).shippingCharges) || 0) : 0;
      await saleService.cancelSale(selectedSale.id, { shippingDeduction: shippingToDeduct });
      toast.success(`Invoice ${selectedSale.invoiceNo} has been cancelled.${shippingToDeduct > 0 ? ` Shipping Rs.${shippingToDeduct.toLocaleString()} deducted from refund.` : ''}`);
      setCancelInvoiceDialogOpen(false);
      setCancelDeductShipping(true);
      setSelectedSale(null);
      setViewDetailsOpen(false);
      await refreshSales();
    } catch (error: any) {
      console.error('Cancel invoice error:', error);
      toast.error(error?.message || 'Failed to cancel invoice');
    } finally {
      setCancellingInvoice(false);
    }
  };
  
  // 🎯 UPDATE SHIPPING (sale_shipments + shipment_history)
  const handleUpdateShippingSubmit = async () => {
    if (!selectedSale?.firstShipmentId) return;
    setUpdateShippingSaving(true);
    try {
      await shipmentService.update(
        selectedSale.firstShipmentId,
        {
          courier_name: updateShippingForm.courierName || undefined,
          tracking_id: updateShippingForm.trackingId || undefined,
          shipment_status: updateShippingForm.shipmentStatus as any,
        },
        user?.id
      );
      toast.success('Shipping updated. History recorded.');
      setShippingDialogOpen(false);
      setSelectedSale(null);
      setUpdateShippingLoadedShipmentId(null);
      await refreshSales();
    } catch (error: any) {
      console.error('Update shipping error:', error);
      toast.error(error?.message || 'Failed to update shipping');
    } finally {
      setUpdateShippingSaving(false);
    }
  };

  // Column visibility state
  // REMOVED: contact and paymentMethod columns per UX requirements
  const [visibleColumns, setVisibleColumns] = useState({
    actions: true,
    date: true,
    invoiceNo: true,
    notes: true, // Reference / Notes
    type: true, // POS vs Regular (same as SalesListDesignTestPage)
    customer: true,
    contact: false, // REMOVED from default view
    location: true,
    saleStatus: true, // Show sale status (draft/quotation/order only, final hidden)
    paymentStatus: true,
    paymentMethod: false, // REMOVED from default view
    total: true,
    paid: true,
    due: true,
    returnDue: false,
    return: true, // New column for return icon
    shipping: true,
    items: true,
    createdBy: true, // User who created the sale (audit)
  });
  
  // Bulk selection and actions removed - using single-row actions only

  // Column order state - defines the order of columns
  // REMOVED: contact and paymentMethod from default order
  const [columnOrder, setColumnOrder] = useState([
    'actions', // Action column first for easier access
    'date',
    'invoiceNo',
    'notes',
    'type', // POS vs Regular (same as SalesListDesignTestPage)
    'customer',
    'location',
    'saleStatus', // Sale status (draft/quotation/order only)
    'paymentStatus',
    'total',
    'paid',
    'due',
    'returnDue',
    'return', // New column for return icon
    'shipping',
    'items',
    'createdBy', // Created By (user full name)
  ]);

  // Columns configuration for Column Manager - ordered based on columnOrder
  const columns = columnOrder.map(key => {
    const labels: Record<string, string> = {
      actions: 'Actions',
      date: 'Date',
      invoiceNo: 'Invoice No.',
      notes: 'Ref / Notes',
      type: 'Type',
      customer: 'Customer',
      contact: 'Contact',
      location: 'Location',
      saleStatus: 'Sale Status',
      paymentStatus: 'Payment Status',
      paymentMethod: 'Payment Method',
      total: 'Total Amount',
      paid: 'Paid',
      due: 'Due',
      returnDue: 'Return Due',
      return: 'Return',
      shipping: 'Shipping Status',
      items: 'Items',
      createdBy: 'Created By',
    };
    return { key, label: labels[key] };
  });

  const toggleColumn = (key: string) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key as keyof typeof visibleColumns] }));
  };

  // Move column up in order
  const moveColumnUp = (key: string) => {
    const index = columnOrder.indexOf(key);
    if (index > 0) {
      const newOrder = [...columnOrder];
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
      setColumnOrder(newOrder);
    }
  };

  // Move column down in order
  const moveColumnDown = (key: string) => {
    const index = columnOrder.indexOf(key);
    if (index < columnOrder.length - 1) {
      const newOrder = [...columnOrder];
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      setColumnOrder(newOrder);
    }
  };

  // Get column widths based on column key
  const getColumnWidth = (key: string): string => {
    const widths: Record<string, string> = {
      actions: '60px',
      date: '100px',
      invoiceNo: '110px',
      notes: '120px',
      type: '100px',
      customer: '200px',
      contact: '140px',
      location: '150px',
      saleStatus: '120px',
      paymentStatus: '130px',
      paymentMethod: '130px',
      total: '110px',
      paid: '110px',
      due: '110px',
      returnDue: '110px',
      return: '80px',
      shipping: '120px',
      items: '80px',
      createdBy: '120px',
    };
    return widths[key] || '100px';
  };

  // Column alignments - shared between header and data cells
  const alignments: Record<string, string> = {
    actions: 'text-center',
    date: 'text-left',
    invoiceNo: 'text-left',
    type: 'text-left',
    customer: 'text-left',
    contact: 'text-left',
    location: 'text-left',
    saleStatus: 'text-center',
    paymentStatus: 'text-center',
    paymentMethod: 'text-center',
    total: 'text-right',
    paid: 'text-right',
    due: 'text-right',
    returnDue: 'text-right',
    return: 'text-center',
    shipping: 'text-center',
    items: 'text-center',
    createdBy: 'text-center',
  };

  // Build grid template columns string based on column order
  const gridTemplateColumns = useMemo(() => {
    const columns = columnOrder
      .filter(key => visibleColumns[key as keyof typeof visibleColumns])
      .map(key => getColumnWidth(key))
      .join(' ');
    return columns.trim();
  }, [columnOrder, visibleColumns]);

  // Helper: POS = invoice prefix POS- or walk-in + final
  const isLikelyPOS = (sale: Sale): boolean => {
    const inv = (sale.invoiceNo || '').trim();
    if (inv.startsWith('POS-')) return true;
    const walkIn = sale.customerName?.toLowerCase().includes('walk-in') || sale.customer === 'walk-in';
    const final = sale.status === 'final';
    return !!(walkIn && final);
  };

  // Helper: Studio = invoice prefix STD- / ST- or is_studio or has studio charges
  const isStudioSale = (sale: Sale): boolean => {
    const inv = (sale.invoiceNo || '').trim();
    if (inv.startsWith('STD-') || inv.startsWith('ST-')) return true;
    if ((sale as any).is_studio === true) return true;
    if (Number(sale.studioCharges ?? 0) > 0) return true;
    return false;
  };

  const getSourceBadge = (sale: Sale) => {
    if (isLikelyPOS(sale)) {
      return (
        <Badge className="gap-1 h-6 px-2 text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/40">
          <Zap size={12} />
          POS
        </Badge>
      );
    }
    if (isStudioSale(sale)) {
      return (
        <Badge className="gap-1 h-6 px-2 text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/40">
          <Scissors size={12} />
          Studio
        </Badge>
      );
    }
    return (
      <Badge className="gap-1 h-6 px-2 text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/40">
        <Store size={12} />
        Regular
      </Badge>
    );
  };

  // Load sale returns for Returns tab
  const [saleReturnsList, setSaleReturnsList] = useState<any[]>([]);
  const [loadingReturnsList, setLoadingReturnsList] = useState(false);

  useEffect(() => {
    const loadSaleReturns = async () => {
      if (!companyId || activeTab !== 'returns') return;
      try {
        setLoadingReturnsList(true);
        const returns = await saleReturnService.getSaleReturns(companyId, branchId === 'all' ? undefined : branchId || undefined);
        setSaleReturnsList(returns);
      } catch (error) {
        console.error('[SALES PAGE] Error loading sale returns:', error);
        toast.error('Failed to load sale returns');
      } finally {
        setLoadingReturnsList(false);
      }
    };
    loadSaleReturns();
  }, [companyId, branchId, activeTab]);

  // Filtered sales - Use real data from context (TASK 1 FIX - "All" means no filter)
  const filteredSales = useMemo(() => {
    // If Returns tab is active, return empty (returns are shown separately)
    if (activeTab === 'returns') return [];
    
    return sales.filter((sale: Sale) => {
      // Tab filter - POS vs Regular vs Quotation vs Final
      if (activeTab === 'pos') {
        if (!isLikelyPOS(sale)) return false;
      } else if (activeTab === 'regular') {
        if (isLikelyPOS(sale)) return false;
      } else if (activeTab === 'quotation') {
        if (getEffectiveSaleStatus(sale) !== 'quotation') return false;
      } else if (activeTab === 'final') {
        if (getEffectiveSaleStatus(sale) !== 'final') return false;
      }
      // activeTab === 'all' shows all

      // Global filter date range
      if (startDate && endDate) {
        const saleDate = new Date(sale.date);
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (saleDate < start || saleDate > end) return false;
      }
      // If no date range, show all (no filter applied)

      // Search filter (invoice, customer, branch, REF in notes, draft/quote/order #, SKU / product on lines)
      if (searchTerm && !saleMatchesSearchTerm(sale, searchTerm)) return false;

      // Date filter (local filter - can be removed if using global date range only)
      if (dateFilter !== 'all') {
        // Add date filter logic here
      }

      // Customer filter
      if (customerFilter !== 'all' && sale.customer !== customerFilter) return false;

      // Payment status filter
      if (paymentStatusFilter !== 'all' && sale.paymentStatus !== paymentStatusFilter) return false;

      // Sale lifecycle status filter (draft / quotation / order / final)
      if (saleStatusFilter !== 'all' && (sale as any).status !== saleStatusFilter) return false;

      // Shipping status filter
      if (shippingStatusFilter !== 'all' && sale.shippingStatus !== shippingStatusFilter) return false;

      // Branch filter
      if (branchFilter !== 'all' && sale.location !== branchFilter) return false;

      // Payment method filter
      if (paymentMethodFilter !== 'all' && sale.paymentMethod !== paymentMethodFilter) return false;

      return true;
    });
  }, [sales, activeTab, startDate, endDate, searchTerm, dateFilter, customerFilter, paymentStatusFilter, saleStatusFilter, shippingStatusFilter, branchFilter, paymentMethodFilter]);

  // Sort state: default createdAt descending so newest-created sales appear first
  type SaleSortKey = 'date' | 'createdAt' | 'invoiceNo' | 'customer' | 'location' | 'saleStatus' | 'paymentStatus' | 'total' | 'paid' | 'due' | 'returnDue' | 'return' | 'shipping' | 'items' | 'createdBy';
  const [sortKey, setSortKey] = useState<SaleSortKey>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const getSaleSortValue = (s: Sale, key: SaleSortKey): string | number => {
    if (key === 'date') return new Date(s.date).getTime();
    if (key === 'createdAt') return new Date((s as any).createdAt || s.date || 0).getTime();
    if (key === 'customer') return s.customerName || s.customer || '';
    if (key === 'shipping') return s.shippingStatus || '';
    if (key === 'items') return s.itemsCount ?? s.items?.length ?? 0;
    if (key === 'createdBy') return s.createdBy ?? '';
    if (key === 'total') return getSaleBillableAmount(s);
    const v = (s as any)[key];
    if (typeof v === 'number') return v;
    return String(v ?? '');
  };

  const sortedSales = useMemo(() => {
    return [...filteredSales].sort((a, b) => {
      const va = getSaleSortValue(a, sortKey);
      const vb = getSaleSortValue(b, sortKey);
      const cmp = typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filteredSales, sortKey, sortDir]);

  const handleSort = (key: SaleSortKey) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
    setCurrentPage(1);
  };

  // Effective due = billable invoice (product + shipment + studio) − paid
  const getEffectiveDue = useCallback((s: Sale) =>
    Math.max(0, getSaleBillableAmount(s) - (s.paid ?? 0)), []);

  // ERP golden rule: only FINAL (posted) sales affect totals
  const finalSalesForSummary = useMemo(
    () => sortedSales.filter((s) => (s as any).status === 'final'),
    [sortedSales]
  );
  const summary = useMemo(() => ({
    totalSales: finalSalesForSummary.reduce((sum, s) => sum + getSaleBillableAmount(s), 0),
    totalPaid: finalSalesForSummary.reduce((sum, s) => sum + s.paid, 0),
    totalDue: finalSalesForSummary.reduce((sum, s) => sum + getEffectiveDue(s), 0),
    invoiceCount: finalSalesForSummary.length,
  }), [finalSalesForSummary, getEffectiveDue]);

  // Client-side pagination: context loads all sales (capped); we filter, sort, then slice for current page
  const pageSize = contextPageSize ?? 50;
  const totalFilteredCount = sortedSales.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredCount / pageSize));
  const currentPage = Math.min(page + 1, totalPages);

  const paginatedSales = useMemo(
    () => sortedSales.slice(page * pageSize, (page + 1) * pageSize),
    [sortedSales, page, pageSize]
  );

  // Paid amount from payment records (fixes wrong sales.paid_amount in table - same as ViewSaleDetailsDrawer)
  const [paidBySaleId, setPaidBySaleId] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    if (paginatedSales.length === 0) {
      setPaidBySaleId(new Map());
      return;
    }
    let cancelled = false;
    const saleIds = paginatedSales.map((s) => s.id);
    Promise.all(saleIds.map((id) => saleService.getSalePayments(id)))
      .then((results) => {
        if (cancelled) return;
        const map = new Map<string, number>();
        results.forEach((payments, i) => {
          const id = saleIds[i];
          const sum = (payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
          map.set(id, sum);
        });
        setPaidBySaleId(map);
      })
      .catch(() => {
        if (!cancelled) setPaidBySaleId(new Map());
      });
    return () => { cancelled = true; };
  }, [paginatedSales]);

  const getDisplayPaid = useCallback((sale: Sale) => paidBySaleId.get(sale.id) ?? sale.paid ?? 0, [paidBySaleId]);
  const getEffectiveDueForDisplay = useCallback(
    (sale: Sale) =>
      Math.max(
        0,
        getSaleBillableAmount(sale) - (paidBySaleId.get(sale.id) ?? sale.paid ?? 0)
      ),
    [paidBySaleId]
  );

  // Reset to page 0 when filters change
  React.useEffect(() => {
    setPage(0);
  }, [searchTerm, dateFilter, customerFilter, paymentStatusFilter, saleStatusFilter, shippingStatusFilter, branchFilter, paymentMethodFilter, setPage]);

  // Clamp page when total pages shrinks (e.g. filter leaves fewer pages)
  React.useEffect(() => {
    if (totalPages >= 1 && page >= totalPages) setPage(totalPages - 1);
  }, [totalPages, page, setPage]);

  const handlePageChange = (p: number) => {
    setPage(Math.max(0, p - 1));
  };

  const handlePageSizeChange = (_size: number) => {
    setPage(0);
  };

  const clearAllFilters = () => {
    setDateFilter('all');
    setCustomerFilter('all');
    setPaymentStatusFilter('all');
    setSaleStatusFilter('all');
    setShippingStatusFilter('all');
    setBranchFilter('all');
    setPaymentMethodFilter('all');
  };

  const activeFilterCount = [
    dateFilter !== 'all',
    customerFilter !== 'all',
    paymentStatusFilter !== 'all',
    saleStatusFilter !== 'all',
    shippingStatusFilter !== 'all',
    branchFilter !== 'all',
    paymentMethodFilter !== 'all',
  ].filter(Boolean).length;

  const getPaymentStatusBadge = (status: PaymentStatus) => {
    const config: Record<string, { bg: string; text: string; border: string; icon: typeof CheckCircle }> = {
      paid: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', icon: CheckCircle },
      partial: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30', icon: Clock },
      unpaid: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', icon: XCircle },
    };
    const c = config[status] ?? config.paid ?? { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30', icon: CheckCircle };
    const { bg, text, border, icon: Icon } = c;
    return (
      <Badge className={cn('text-xs font-medium capitalize gap-1 h-6 px-2', bg, text, border)}>
        <Icon size={12} />
        {status}
      </Badge>
    );
  };

  const getShippingStatusBadge = (status: string, options?: { iconOnly?: boolean }) => {
    const s = (status || '').toString();
    const config: Record<string, { bg: string; text: string; border: string; icon: string }> = {
      Booked: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30', icon: '📦' },
      Picked: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', icon: '📦' },
      'In Transit': { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', icon: '🚚' },
      'Out for Delivery': { bg: 'bg-indigo-500/20', text: 'text-indigo-400', border: 'border-indigo-500/30', icon: '🚚' },
      Delivered: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', icon: '✅' },
      delivered: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', icon: '✅' },
      Returned: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30', icon: '↩️' },
      Cancelled: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', icon: '❌' },
      cancelled: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', icon: '❌' },
      Dispatched: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', icon: '🚚' },
      processing: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', icon: '🚚' },
      pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30', icon: '📦' },
      Pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30', icon: '📦' },
    };
    const c = config[s] ?? { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30', icon: '📦' };
    const { bg, text, border, icon } = c;
    const label = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    return (
      <Badge className={cn('text-xs font-medium h-6 px-2 flex items-center gap-1', bg, text, border)}>
        {!options?.iconOnly && <span>{icon}</span>}
        {label}
      </Badge>
    );
  };

  // Sale status badge from centralized effective status (draft/final/cancelled/returned/partially_returned)
  const getSaleStatusBadgeFromSale = (sale: Sale) => {
    const config = getSaleStatusBadgeConfig(sale) ?? DEFAULT_SALE_BADGE;
    return (
      <Badge className={cn('text-xs font-medium h-6 px-2 flex items-center gap-1', config.bg, config.text, config.border)}>
        {config.label}
      </Badge>
    );
  };

  // Render column cell based on column key (try/catch prevents "Cannot destructure property 'bg'" in production)
  const renderColumnCell = (columnKey: string, sale: Sale) => {
    try {
      if (columnKey === 'actions') return null;
      switch (columnKey) {
      case 'date':
        // Show date on one line, time on next line (smaller)
        // Use sale.date (the actual sale date) instead of sale.createdAt (database timestamp)
        const dateTime = formatDateAndTime(sale.date || sale.createdAt);
        return (
          <div className="flex flex-col text-sm text-gray-400">
            <span>{dateTime.date}</span>
            <span className="text-xs text-gray-500">{dateTime.time}</span>
          </div>
        );
      
      case 'invoiceNo': {
        const displayNo =
          getSaleDisplayNumber({
            status: sale.status,
            invoice_no: sale.invoiceNo,
            draft_no: sale.draftNo,
            quotation_no: sale.quotationNo,
            order_no: sale.orderNo,
          }) || sale.invoiceNo;
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void handleSaleAction('view_details', sale);
            }}
            className="text-sm text-blue-400 font-mono font-semibold hover:underline text-left"
          >
            {displayNo}
          </button>
        );
      }

      case 'notes':
        return (
          <div className="text-sm text-gray-400 truncate max-w-[120px]" title={(sale as any).notes || ''}>
            {(sale as any).notes || '-'}
          </div>
        );

      case 'type':
        return getSourceBadge(sale);

      case 'customer':
        // Customer column: Name + Phone (if exists)
        // Same UX pattern as Supplier list
        return (
          <div className="min-w-0">
            <div className="text-sm font-medium text-white truncate leading-[1.3]">
              {sale.customerName || 'Walk-in Customer'}
            </div>
            {/* Show phone number if exists - no placeholder/icon/dash if empty */}
            {sale.contactNumber && sale.contactNumber.trim() && (
              <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                <Phone size={10} className="text-gray-600" />
                <span className="truncate">{sale.contactNumber}</span>
              </div>
            )}
          </div>
        );
      
      case 'contact':
        // Legacy column - kept for backwards compatibility but hidden by default
        return (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Phone size={12} className="text-gray-600" />
            <span className="truncate">{sale.contactNumber || '—'}</span>
          </div>
        );
      
      case 'location':
        // UI Rule: Show branch NAME only (not code, never UUID)
        // sale.location now contains branch name from context (or empty)
        // Fallback to branchMap for old data that might still have UUID or empty location
        let locationText = sale.location || '';
        
        // CRITICAL FIX: If location is empty, try to resolve using branch_id from salesBranchIdMap
        if (!locationText && branchMap.size > 0) {
          const saleBranchId = salesBranchIdMap.get(sale.id);
          if (saleBranchId && branchMap.has(saleBranchId)) {
            locationText = branchMap.get(saleBranchId) || '';
          }
        }
        
        // If it looks like a UUID, try branchMap fallback
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(locationText);
        if (isUUID && branchMap.size > 0) {
          const resolved = branchMap.get(locationText);
          // Extract just the name if branchMap returns "BR-001 | Name" format
          if (resolved && resolved.includes('|')) {
            locationText = resolved.split('|').pop()?.trim() || '';
          } else {
            locationText = resolved || locationText; // Keep UUID if not found (shouldn't happen)
          }
        }
        // If it contains '|' (old format), extract just the name
        if (locationText.includes('|')) {
          locationText = locationText.split('|').pop()?.trim() || '';
        }
        
        return (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <MapPin size={12} className="text-gray-600" />
            <span className="truncate">{locationText || '—'}</span>
          </div>
        );
      
      case 'saleStatus':
        // Enhanced Status Column: Badge from effective status + Return Icon + Attachment Icon
        const statusBadge = getSaleStatusBadgeFromSale(sale);
        const hasReturn = sale.status === 'final' && salesWithReturns.has(sale.id);
        const hasAttachments = sale.attachments && Array.isArray(sale.attachments) && sale.attachments.length > 0;
        
        return (
          <div className={cn("flex items-center gap-2", alignments['saleStatus'])}>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="p-0 h-auto bg-transparent border-0 cursor-pointer hover:opacity-90"
                  onClick={(e) => e.stopPropagation()}
                >
                  {statusBadge || <span className="text-xs text-gray-600">—</span>}
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-auto p-0 border-gray-700 bg-gray-900 text-white"
                onClick={(e) => e.stopPropagation()}
              >
                <SaleLifecycleMenuBlock sale={sale} onPick={(a) => void runSaleLifecycleFromUi(sale, a)} />
              </PopoverContent>
            </Popover>
            {hasReturn && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedSaleForReturns(sale);
                  setViewReturnsDialogOpen(true);
                  // Load returns for this sale
                  const loadReturns = async () => {
                    if (!companyId) return;
                    setLoadingReturns(true);
                    try {
                      const allReturns = await saleReturnService.getSaleReturns(companyId, branchId === 'all' ? undefined : branchId || undefined);
                      const saleReturns = allReturns.filter(r => r.original_sale_id === sale.id);
                      setSaleReturns(saleReturns);
                    } catch (error: any) {
                      toast.error(error.message || 'Failed to load returns');
                    } finally {
                      setLoadingReturns(false);
                    }
                  };
                  loadReturns();
                }}
                className="p-0.5 hover:bg-purple-500/20 rounded transition-colors"
                title="View sale returns"
              >
                <RotateCcw 
                  size={14} 
                  className="text-purple-400" 
                />
              </button>
            )}
            {hasAttachments && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const attachments: { url: string; name: string }[] = [];
                  sale.attachments?.forEach((att: any) => {
                    const url = typeof att === 'string' ? att : (att?.url || att?.fileUrl || '');
                    const name = typeof att === 'object' && att?.name ? att.name : (typeof att === 'object' && (att?.fileName || att?.file_name) ? (att.fileName || att.file_name) : 'Attachment');
                    if (url) attachments.push({ url: String(url), name: name || 'Attachment' });
                  });
                  if (attachments.length) setAttachmentsDialogList(attachments);
                }}
                className="p-0.5 hover:bg-amber-500/20 rounded transition-colors"
                title="View attachment"
              >
                <Paperclip 
                  size={14} 
                  className="text-amber-400" 
                />
              </button>
            )}
          </div>
        );
      
      case 'paymentStatus': {
        const effectiveStatus = getEffectiveSaleStatus(sale);
        if (effectiveStatus === 'draft' || effectiveStatus === 'quotation' || effectiveStatus === 'order') {
          return <span className="text-xs text-gray-500">—</span>;
        }
        const paymentClosed = isPaymentClosedForSale(sale);
        const isCancelled = effectiveStatus === 'cancelled';
        if (paymentClosed || isCancelled) {
          return (
            <span
              className="cursor-default opacity-70 inline-block pointer-events-none"
              title={isCancelled ? 'Invoice is cancelled' : 'Closed'}
            >
              {getPaymentStatusBadge(sale.paymentStatus)}
            </span>
          );
        }
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedSale(sale);
              setViewPaymentsOpen(true);
            }}
            className="cursor-pointer hover:scale-105 transition-transform"
            title="Click to view payments"
          >
            {getPaymentStatusBadge(sale.paymentStatus)}
          </button>
        );
      }
      
      case 'paymentMethod': {
        const st = getEffectiveSaleStatus(sale);
        if (st === 'draft' || st === 'quotation' || st === 'order') {
          return <span className="text-xs text-gray-500">—</span>;
        }
        return (
          <span className="text-xs text-gray-400">{sale.paymentMethod}</span>
        );
      }
      
      case 'total':
        return (
          <div className="text-sm font-semibold text-white tabular-nums">
            {formatCurrency(getSaleBillableAmount(sale))}
          </div>
        );
      
      case 'paid': {
        const effectiveStatusPaid = getEffectiveSaleStatus(sale);
        if (effectiveStatusPaid === 'draft' || effectiveStatusPaid === 'quotation' || effectiveStatusPaid === 'order') {
          return <span className="text-sm text-gray-500">—</span>;
        }
        return (
          <div className="text-sm font-semibold text-green-400 tabular-nums">
            {formatCurrency(getDisplayPaid(sale))}
          </div>
        );
      }
      
      case 'due': {
        const effectiveStatusDue = getEffectiveSaleStatus(sale);
        if (effectiveStatusDue === 'draft' || effectiveStatusDue === 'quotation' || effectiveStatusDue === 'order') {
          return <span className="text-sm text-gray-500">—</span>;
        }
        const effectiveDue = getEffectiveDueForDisplay(sale);
        const paymentClosed = isPaymentClosedForSale(sale);
        const canPay = canAddPaymentToSale(sale, effectiveDue);
        if (paymentClosed) {
          return (
            <span
              className="text-sm text-gray-500 tabular-nums cursor-default"
              title={effectiveStatusDue === 'cancelled' ? 'Invoice is cancelled' : 'Closed'}
            >
              Closed
            </span>
          );
        }
        if (effectiveDue > 0 && canPay) {
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSaleAction('receive_payment', sale);
              }}
              className="text-sm font-semibold text-red-400 tabular-nums hover:text-red-300 hover:underline cursor-pointer text-right w-full"
            >
              {formatCurrency(effectiveDue)}
            </button>
          );
        }
        return (
          effectiveDue > 0 ? (
            <div className="text-sm font-semibold text-red-400 tabular-nums">{formatCurrency(effectiveDue)}</div>
          ) : (
            <div className="text-sm text-gray-600">-</div>
          )
        );
      }
      
      case 'returnDue':
        return (
          sale.returnDue > 0 ? (
            <div className="text-sm font-semibold text-orange-400 tabular-nums">
              {formatCurrency(sale.returnDue)}
            </div>
          ) : (
            <div className="text-sm text-gray-600">-</div>
          )
        );
      
      case 'return':
        // Show return icon if sale has returns AND sale is final (only final sales can have returns)
        const saleHasReturn = sale.status === 'final' && salesWithReturns.has(sale.id);
        return (
          saleHasReturn ? (
            <RotateCcw 
              size={16} 
              className="text-purple-400" 
              title="This sale has returns"
            />
          ) : (
            <span className="text-xs text-gray-600">—</span>
          )
        );
      
      case 'shipping':
        // If no shipment, show "—". If shipment exists, show status badge; click opens Shipment History drawer.
        if (!sale.hasShipment || !sale.firstShipmentId) {
          return <span className="text-xs text-gray-600">—</span>;
        }
        return (
          <button
            type="button"
            className="cursor-pointer hover:opacity-90 transition-opacity flex items-center gap-1"
            title="View shipment history"
            onClick={(e) => {
              e.stopPropagation();
              setShipmentHistoryShipmentId(sale.firstShipmentId ?? null);
              setShipmentHistoryInvoiceNo(sale.invoiceNo ?? '');
              setShipmentHistoryDrawerOpen(true);
            }}
          >
            {getShippingStatusBadge(sale.shippingStatus as string)}
          </button>
        );
      
      case 'items':
        // Handle both array and number types for items
        const itemsCount = Array.isArray(sale.items) ? sale.items.length : (sale.itemsCount || sale.items || 0);
        return (
          <div className="flex items-center gap-1 text-gray-300">
            <Package size={12} className="text-gray-500" />
            <span className="text-sm font-medium">{itemsCount}</span>
          </div>
        );
      
      case 'createdBy':
        return (
          <span className="text-xs text-gray-400 truncate" title={sale.createdBy || '—'}>
            {sale.createdBy || '—'}
          </span>
        );
      
      default:
        return null;
    }
    } catch (_) {
      return <span className="text-gray-500 text-xs">—</span>;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#0B0F19]">
      {/* Page Header - Fixed */}
      <div className="shrink-0 px-6 py-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Sales</h1>
            <p className="text-sm text-gray-400 mt-0.5">Manage your sales and customer invoices</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentView('sales-list-design-test')}
              className="h-10 text-gray-400 border-gray-700 hover:bg-gray-800 hover:text-white"
            >
              Design test
            </Button>
            {companyId && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowQuotationWorkflow(true)}
                  className="h-10 text-gray-400 border-gray-700 hover:bg-gray-800 hover:text-white gap-2"
                >
                  <FileText size={16} />
                  Quotation
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBulkInvoiceWorkflow(true)}
                  className="h-10 text-gray-400 border-gray-700 hover:bg-gray-800 hover:text-white gap-2"
                >
                  <FileText size={16} />
                  Bulk Invoice
                </Button>
              </>
            )}
          {canCreateSale && (
          <Button 
            onClick={() => openDrawer('addSale')}
            className="bg-blue-600 hover:bg-blue-500 text-white h-10 gap-2"
          >
            <Plus size={16} />
            Add Sale
          </Button>
          )}
          </div>
        </div>
      </div>

      {/* Summary Cards - Fixed */}
      <div className="shrink-0 px-6 py-4 bg-[#0F1419] border-b border-gray-800">
        <div className="grid grid-cols-4 gap-4">
          {/* Total Sales */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Total Sales</p>
                <p className="text-2xl font-bold text-white mt-1">{formatCurrency(summary.totalSales)}</p>
                <p className="text-xs text-gray-500 mt-1">All invoices</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <ShoppingCart size={24} className="text-blue-500" />
              </div>
            </div>
          </div>

          {/* Total Paid */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Total Paid</p>
                <p className="text-2xl font-bold text-green-400 mt-1">{formatCurrency(summary.totalPaid)}</p>
                <p className="text-xs text-gray-500 mt-1">Received amount</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <DollarSign size={24} className="text-green-500" />
              </div>
            </div>
          </div>

          {/* Total Due */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Total Due</p>
                <p className="text-2xl font-bold text-red-400 mt-1">{formatCurrency(summary.totalDue)}</p>
                <p className="text-xs text-gray-500 mt-1">Pending payments</p>
                <p className="text-[10px] text-gray-500 mt-2 leading-snug">
                  Listed final sales: effective due (product + shipment to customer + studio − paid). Not Contacts operational receivables or GL AR 1100 — use Contacts reconciliation or Financial reports to tie out.
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertCircle size={24} className="text-red-500" />
              </div>
            </div>
          </div>

          {/* Invoices */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Total Invoices</p>
                <p className="text-2xl font-bold text-white mt-1">{summary.invoiceCount}</p>
                <p className="text-xs text-gray-500 mt-1">Active orders</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                <FileText size={24} className="text-purple-500" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Global List Toolbar */}
      <ListToolbar
        search={{
          value: searchTerm,
          onChange: setSearchTerm,
          placeholder: "Search invoice #, customer, REF (in notes), draft/quote/order #, SKU, product, branch..."
        }}
        rowsSelector={{
          value: pageSize,
          onChange: handlePageSizeChange,
          totalItems: filteredSales.length
        }}
        columnsManager={{
          columns,
          visibleColumns,
          onToggle: toggleColumn,
          onShowAll: () => {
            const allVisible = Object.keys(visibleColumns).reduce((acc, key) => {
              acc[key as keyof typeof visibleColumns] = true;
              return acc;
            }, {} as typeof visibleColumns);
            setVisibleColumns(allVisible);
          },
          onMoveUp: moveColumnUp,
          onMoveDown: moveColumnDown,
        }}
        filter={{
          isOpen: filterOpen,
          onToggle: () => setFilterOpen(!filterOpen),
          activeCount: activeFilterCount,
          renderPanel: () => (
            <div className="absolute right-0 top-12 w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-4 z-50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white">Advanced Filters</h3>
                <button
                  onClick={clearAllFilters}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Clear All
                </button>
              </div>

              <div className="space-y-4 max-h-[500px] overflow-y-auto">
                {/* Date Filter */}
                <div>
                  <label className="text-xs text-gray-400 mb-2 block font-medium">Date Range</label>
                  <div className="space-y-2">
                    {[
                      { value: 'all', label: 'All Dates' },
                      { value: 'today', label: 'Today' },
                      { value: 'yesterday', label: 'Yesterday' },
                      { value: 'thisWeek', label: 'This Week' },
                      { value: 'thisMonth', label: 'This Month' },
                      { value: 'custom', label: 'Custom Range' },
                    ].map(opt => (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="date"
                          checked={dateFilter === opt.value}
                          onChange={() => setDateFilter(opt.value)}
                          className="w-4 h-4 bg-gray-950 border-gray-700"
                        />
                        <span className="text-sm text-gray-300">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Payment Status Filter */}
                <div>
                  <label className="text-xs text-gray-400 mb-2 block font-medium">Payment Status</label>
                  <div className="space-y-2">
                    {[
                      { value: 'all', label: 'All Status' },
                      { value: 'paid', label: 'Paid' },
                      { value: 'partial', label: 'Partial' },
                      { value: 'unpaid', label: 'Unpaid' },
                    ].map(opt => (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="paymentStatus"
                          checked={paymentStatusFilter === opt.value}
                          onChange={() => setPaymentStatusFilter(opt.value as any)}
                          className="w-4 h-4 bg-gray-950 border-gray-700"
                        />
                        <span className="text-sm text-gray-300">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Sale Status (Lifecycle) Filter */}
                <div>
                  <label className="text-xs text-gray-400 mb-2 block font-medium">Sale Status</label>
                  <div className="space-y-2">
                    {[
                      { value: 'all', label: 'All' },
                      { value: 'draft', label: 'Draft' },
                      { value: 'quotation', label: 'Quotation' },
                      { value: 'order', label: 'Sales Order' },
                      { value: 'final', label: 'Final Invoice' },
                      { value: 'cancelled', label: 'Cancelled' },
                    ].map(opt => (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="saleStatus"
                          checked={saleStatusFilter === opt.value}
                          onChange={() => setSaleStatusFilter(opt.value as any)}
                          className="w-4 h-4 bg-gray-950 border-gray-700"
                        />
                        <span className="text-sm text-gray-300">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Shipping Status Filter */}
                <div>
                  <label className="text-xs text-gray-400 mb-2 block font-medium">Shipping Status</label>
                  <div className="space-y-2">
                    {[
                      { value: 'all', label: 'All Status' },
                      { value: 'delivered', label: 'Delivered' },
                      { value: 'processing', label: 'Processing' },
                      { value: 'pending', label: 'Pending' },
                      { value: 'cancelled', label: 'Cancelled' },
                    ].map(opt => (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="shippingStatus"
                          checked={shippingStatusFilter === opt.value}
                          onChange={() => setShippingStatusFilter(opt.value as any)}
                          className="w-4 h-4 bg-gray-950 border-gray-700"
                        />
                        <span className="text-sm text-gray-300">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Branch Filter */}
                <div>
                  <label className="text-xs text-gray-400 mb-2 block font-medium">Branch</label>
                  <div className="space-y-2">
                    {[
                      { value: 'all', label: 'All Branches' },
                      { value: 'Main Branch (HQ)', label: 'Main Branch (HQ)' },
                      { value: 'Mall Outlet', label: 'Mall Outlet' },
                      { value: 'Warehouse', label: 'Warehouse' },
                    ].map(opt => (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="branch"
                          checked={branchFilter === opt.value}
                          onChange={() => setBranchFilter(opt.value)}
                          className="w-4 h-4 bg-gray-950 border-gray-700"
                        />
                        <span className="text-sm text-gray-300">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Payment Method Filter */}
                <div>
                  <label className="text-xs text-gray-400 mb-2 block font-medium">Payment Method</label>
                  <div className="space-y-2">
                    {[
                      { value: 'all', label: 'All Methods' },
                      { value: 'Cash', label: 'Cash' },
                      { value: 'Card', label: 'Card' },
                      { value: 'Bank Transfer', label: 'Bank Transfer' },
                      { value: 'Credit', label: 'Credit' },
                    ].map(opt => (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="paymentMethod"
                          checked={paymentMethodFilter === opt.value}
                          onChange={() => setPaymentMethodFilter(opt.value)}
                          className="w-4 h-4 bg-gray-950 border-gray-700"
                        />
                        <span className="text-sm text-gray-300">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )
        }}
        importConfig={{
          onImport: () => toast.info('Sales import coming soon. Use Add Sale to create invoices.')
        }}
        exportConfig={{
          onExportCSV: () => {
            const data: ExportData = {
              headers: ['Invoice #', 'Date', 'Customer', 'Contact', 'Location', 'Items', 'Subtotal', 'Total', 'Paid', 'Due', 'Payment Status', 'Payment Method'],
              rows: sortedSales.map(s => [s.invoiceNo, s.date, s.customerName, s.contactNumber || '', s.location || '', s.itemsCount, s.subtotal, getSaleBillableAmount(s), s.paid, s.due, s.paymentStatus, s.paymentMethod || '']),
              title: 'Sales'
            };
            try { exportToCSV(data, 'sales'); toast.success('Sales exported as CSV'); } catch (e) { toast.error('Export failed'); }
          },
          onExportExcel: () => {
            const data: ExportData = {
              headers: ['Invoice #', 'Date', 'Customer', 'Contact', 'Location', 'Items', 'Subtotal', 'Total', 'Paid', 'Due', 'Payment Status', 'Payment Method'],
              rows: sortedSales.map(s => [s.invoiceNo, s.date, s.customerName, s.contactNumber || '', s.location || '', s.itemsCount, s.subtotal, getSaleBillableAmount(s), s.paid, s.due, s.paymentStatus, s.paymentMethod || '']),
              title: 'Sales'
            };
            try { exportToExcel(data, 'sales'); toast.success('Sales exported as Excel'); } catch (e) { toast.error('Export failed'); }
          },
          onExportPDF: () => {
            const data: ExportData = {
              headers: ['Invoice #', 'Date', 'Customer', 'Contact', 'Location', 'Items', 'Subtotal', 'Total', 'Paid', 'Due', 'Payment Status', 'Payment Method'],
              rows: sortedSales.map(s => [s.invoiceNo, s.date, s.customerName, s.contactNumber || '', s.location || '', s.itemsCount, s.subtotal, getSaleBillableAmount(s), s.paid, s.due, s.paymentStatus, s.paymentMethod || '']),
              title: 'Sales'
            };
            try { exportToPDF(data, 'sales'); toast.success('PDF opened for print'); } catch (e) { toast.error('Export failed'); }
          }
        }}
      />

      {/* Source Tabs: All | POS | Regular | Returns | Quotation | Final */}
      <div className="shrink-0 px-6 py-3 border-b border-gray-800 bg-[#0F1419]">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-medium">Source</p>
        <div className="flex gap-2 flex-wrap items-center">
          {[
            { id: 'all' as const, label: 'All', icon: ShoppingCart },
            { id: 'pos' as const, label: 'POS', icon: Zap },
            { id: 'regular' as const, label: 'Regular', icon: Store },
            { id: 'returns' as const, label: 'Returns', icon: RotateCcw },
            { id: 'quotation' as const, label: 'Quotation', icon: FileText },
            { id: 'final' as const, label: 'Final', icon: CheckCircle2 },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border',
                activeTab === id
                  ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-900/30'
                  : 'bg-gray-800/50 text-gray-400 border-gray-700 hover:bg-gray-800 hover:text-white'
              )}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
          {activeTab === 'returns' && (
            <Button
              size="sm"
              variant="outline"
              className="ml-2 border-amber-500/50 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
              onClick={() => setStandaloneReturnFormOpen(true)}
            >
              <PackageCheck size={16} className="mr-1.5" />
              Return without invoice
            </Button>
          )}
        </div>
      </div>

      {/* Sales Table - Scrollable */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[1400px]">
              {/* Table Header - full-width background (w-max so it spans full table when scrolling) */}
              <div className="sticky top-0 z-10 min-w-[1400px] w-max bg-gray-900 border-b border-gray-800">
                {activeTab === 'returns' ? (
                  // Returns Tab Header - Actions first
                  <div className="grid gap-3 px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider"
                    style={{ gridTemplateColumns: '60px 120px 130px 180px 150px 150px 130px 120px 100px 150px' }}
                  >
                    <div className="text-center">Actions</div>
                    <div className="text-left">Date & Time</div>
                    <div className="text-left">Return No</div>
                    <div className="text-left">Customer</div>
                    <div className="text-left">Original Invoice</div>
                    <div className="text-left">Location</div>
                    <div className="text-center">Status</div>
                    <div className="text-right">Total</div>
                    <div className="text-right">Items</div>
                    <div className="text-left">Reason</div>
                  </div>
                ) : (
                  // Sales Tab Header
                  <div className="grid gap-3 px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider"
                    style={{
                      gridTemplateColumns: gridTemplateColumns
                    }}
                  >
                    {columnOrder.map(key => {
                      if (!visibleColumns[key as keyof typeof visibleColumns]) return null;
                      if (key === 'actions') {
                        return <div key="actions" className="text-center">Actions</div>;
                      }
                      const labels: Record<string, string> = {
                        date: 'Date',
                        invoiceNo: 'Invoice No.',
                        type: 'Type',
                        customer: 'Customer',
                        contact: 'Contact',
                        location: 'Location',
                        saleStatus: 'Status',
                        paymentStatus: 'Payment',
                        paymentMethod: 'Method',
                        total: 'Total',
                        paid: 'Paid',
                        due: 'Due',
                        returnDue: 'Return Due',
                        return: 'Return',
                        shipping: 'Shipping',
                        items: 'Items',
                        createdBy: 'Created By',
                      };
                      const isSortable = (['date', 'invoiceNo', 'customer', 'location', 'saleStatus', 'paymentStatus', 'total', 'paid', 'due', 'returnDue', 'return', 'shipping', 'items', 'createdBy'] as SaleSortKey[]).includes(key as SaleSortKey);
                      const isActive = sortKey === key;
                      
                      return (
                        <div
                          key={key}
                          className={cn(
                            alignments[key],
                            isSortable && 'cursor-pointer select-none hover:text-gray-300',
                            // Use flex for all sortable headers to align icon consistently
                            isSortable && 'flex items-center gap-0.5',
                            // For right-aligned, use justify-end to keep text right
                            alignments[key] === 'text-right' && 'justify-end',
                            // For center-aligned, use justify-center
                            alignments[key] === 'text-center' && 'justify-center',
                            // For left-aligned, use justify-start (default)
                            alignments[key] === 'text-left' && 'justify-start'
                          )}
                          onClick={() => isSortable && handleSort(key as SaleSortKey)}
                        >
                          {labels[key]}
                          {isSortable && isActive && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Table Body - w-max so row lines span full table width (no short lines on right) */}
              <div className="min-w-[1400px] w-max">
                {activeTab === 'returns' ? (
                  // Returns Tab - Show Sale Returns List
                  loadingReturnsList ? (
                    <div className="py-12 text-center">
                      <Loader2 size={48} className="mx-auto text-blue-500 mb-3 animate-spin" />
                      <p className="text-gray-400 text-sm">Loading returns...</p>
                    </div>
                  ) : saleReturnsList.length === 0 ? (
                    <div className="py-12 text-center">
                      <RotateCcw size={48} className="mx-auto text-gray-600 mb-3" />
                      <p className="text-gray-400 text-sm">No returns found</p>
                      <p className="text-gray-600 text-xs mt-1">Create a return from a sale invoice or use &quot;Return without invoice&quot;</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-800/50">
                      {saleReturnsList.map((ret: any) => {
                        const originalSale = ret.original_sale_id ? sales.find(s => s.id === ret.original_sale_id) : null;
                        const dateTime = formatDateAndTime(ret.return_date || ret.created_at);
                        return (
                          <div
                            key={ret.id}
                            onClick={() => {
                              setSelectedReturn(ret);
                              setViewReturnDetailsOpen(true);
                            }}
                            className="grid gap-3 px-4 h-auto min-h-[60px] py-3 min-w-[1400px] w-max hover:bg-gray-800/30 transition-colors items-center border-b border-gray-800 last:border-b-0 cursor-pointer"
                            style={{ gridTemplateColumns: '60px 120px 130px 180px 150px 150px 130px 120px 100px 150px' }}
                          >
                            <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className="w-8 h-8 rounded-lg bg-gray-800/50 hover:bg-gray-700 transition-all flex items-center justify-center text-gray-400 hover:text-white">
                                    <MoreVertical size={16} />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-gray-900 border-gray-700 text-white w-56">
                                  <DropdownMenuItem 
                                    onClick={() => { setSelectedReturn(ret); setViewReturnDetailsOpen(true); }}
                                    className="hover:bg-gray-800 cursor-pointer"
                                  >
                                    <Eye size={14} className="mr-2 text-blue-400" />
                                    View Return Details
                                  </DropdownMenuItem>
                                  {ret.original_sale_id && originalSale && (
                                    <DropdownMenuItem 
                                      onClick={() => { setSelectedSale(originalSale); setViewDetailsOpen(true); }}
                                      className="hover:bg-gray-800 cursor-pointer"
                                    >
                                      <FileText size={14} className="mr-2 text-green-400" />
                                      View Original Sale
                                    </DropdownMenuItem>
                                  )}
                                  {String(ret?.status).toLowerCase() !== 'final' &&
                                    String(ret?.status).toLowerCase() !== 'void' && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem 
                                        onClick={() => {
                                          if (!ret.original_sale_id) {
                                            toast.info('Standalone return (no invoice) cannot be edited. Delete and create a new return if needed.');
                                            return;
                                          }
                                          setSaleReturnSaleId(ret.original_sale_id);
                                          setSaleReturnEditId(ret.id);
                                          setSaleReturnFormOpen(true);
                                        }}
                                        className="hover:bg-gray-800 cursor-pointer"
                                      >
                                        <Edit size={14} className="mr-2 text-green-400" />
                                        Edit Sale Return
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        onClick={() => { setReturnToDelete(ret); setDeleteReturnDialogOpen(true); }}
                                        className="hover:bg-gray-800 cursor-pointer text-red-400"
                                      >
                                        <Trash2 size={14} className="mr-2" />
                                        Delete Return
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  {String(ret?.status).toLowerCase() === 'final' && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem 
                                        onClick={() => { setReturnToVoid(ret); setVoidReturnDialogOpen(true); }}
                                        className="hover:bg-gray-800 cursor-pointer text-amber-400"
                                      >
                                        <RotateCcw size={14} className="mr-2" />
                                        Void / Cancel Return
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  {String(ret?.status).toLowerCase() === 'void' && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem disabled className="opacity-60 cursor-not-allowed text-gray-400">
                                        Voided — locked (audit only). Create a new return to process stock again.
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={async () => {
                                      if (!companyId) return;
                                      try {
                                        const fullReturn = await saleReturnService.getSaleReturnById(ret.id, companyId);
                                        setSelectedReturnForPrint(fullReturn);
                                        setPrintReturnOpen(true);
                                      } catch (error: any) {
                                        console.error('[SalesPage] Error loading return for print:', error);
                                        toast.error('Could not load return details for printing');
                                      }
                                    }}
                                    className="hover:bg-gray-800 cursor-pointer"
                                  >
                                    <Printer size={14} className="mr-2 text-purple-400" />
                                    Print Return
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => { toast.info('Export return functionality coming soon'); }}
                                    className="hover:bg-gray-800 cursor-pointer"
                                  >
                                    <Download size={14} className="mr-2 text-blue-400" />
                                    Export Return
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            <div className="flex flex-col">
                              <div className="text-sm text-gray-300 font-medium">{dateTime.date}</div>
                              <div className="text-xs text-gray-500">{dateTime.time}</div>
                            </div>
                            <div className="text-sm text-purple-400 font-mono font-semibold">{ret.return_no || `RET-${ret.id?.slice(0, 8).toUpperCase()}`}</div>
                            <div className="text-sm text-white font-medium">{ret.customer_name}</div>
                            <div className="text-sm text-blue-400 font-mono">
                              {originalSale ? (
                                <span className="hover:text-blue-300 hover:underline" onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedSale(originalSale);
                                  setViewDetailsOpen(true);
                                }}>
                                  {originalSale.invoiceNo}
                                </span>
                              ) : ret.original_sale_id ? (
                                <span className="text-gray-500">Sale ID: {ret.original_sale_id.slice(0, 8)}</span>
                              ) : (
                                <span className="text-amber-400/90 text-xs">No invoice</span>
                              )}
                            </div>
                            <div className="text-sm text-gray-400">{branchMap.get(ret.branch_id) || '—'}</div>
                            <div className="flex justify-center">
                              <Badge className={
                                String(ret?.status).toLowerCase() === 'void'
                                  ? 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                                  : ret.status === 'final'
                                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                    : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                              }>
                                {String(ret?.status).toLowerCase() === 'void'
                                  ? 'VOID / LOCKED'
                                  : ret.status === 'final'
                                    ? 'FINAL / LOCKED'
                                    : 'Draft'}
                              </Badge>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-semibold text-red-400 tabular-nums">-Rs. {ret.total?.toLocaleString() || '0'}</div>
                            </div>
                            <div className="text-right text-sm text-gray-400">{ret.items_count || ret.items?.length || 0} items</div>
                            <div className="text-sm text-gray-400 truncate" title={ret.reason || ''}>{ret.reason || '—'}</div>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : loading ? (
                  <div className="py-12 text-center">
                    <Loader2 size={48} className="mx-auto text-blue-500 mb-3 animate-spin" />
                    <p className="text-gray-400 text-sm">Loading sales...</p>
                  </div>
                ) : paginatedSales.length === 0 ? (
                  <div className="py-12 text-center">
                    <ShoppingCart size={48} className="mx-auto text-gray-600 mb-3" />
                    <p className="text-gray-400 text-sm">No sales found</p>
                    <p className="text-gray-600 text-xs mt-1">Try adjusting your search or filters</p>
                  </div>
                ) : (
                  paginatedSales.map((sale) => (
                    <div
                      key={sale.id}
                      onMouseEnter={() => setHoveredRow(sale.id || sale.invoiceNo)}
                      onMouseLeave={() => setHoveredRow(null)}
                      className="relative grid gap-3 px-4 h-16 min-w-[1400px] w-max hover:bg-gray-800/30 transition-colors items-center border-b border-gray-800 last:border-b-0"
                      style={{
                        gridTemplateColumns: gridTemplateColumns
                      }}
                    >
                      {/* Render columns in order (Actions first when visible) */}
                      {columnOrder.map(key => {
                        if (!visibleColumns[key as keyof typeof visibleColumns]) return null;
                        if (key === 'actions') {
                          return (
                            <div key="actions" className="flex justify-center">
                              <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button 
                              className={cn(
                                "w-8 h-8 rounded-lg bg-gray-800/50 hover:bg-gray-700 transition-all flex items-center justify-center text-gray-400 hover:text-white",
                                hoveredRow === (sale.id || sale.invoiceNo) ? "opacity-100" : "opacity-0"
                              )}
                            >
                              <MoreVertical size={16} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-gray-900 border-gray-700 text-white w-52">
                            <DropdownMenuItem 
                              className="hover:bg-gray-800 cursor-pointer"
                              onClick={() => handleSaleAction('view_details', sale)}
                            >
                              <Eye size={14} className="mr-2 text-blue-400" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-gray-700" />
                            <div className="px-0 py-1">
                              <SaleLifecycleMenuBlock variant="menu" sale={sale} onPick={(a) => void runSaleLifecycleFromUi(sale, a)} />
                            </div>
                            <DropdownMenuSeparator className="bg-gray-700" />
                            {/* Edit: requires canEditSale (role_permissions sales.edit) and no return lock. RLS allows UPDATE only when created_by = auth.uid() for salesman. */}
                            {canEditSale && !(sale.hasReturn || salesWithReturns.has(sale.id)) && (
                              <DropdownMenuItem 
                                className="hover:bg-gray-800 cursor-pointer"
                                onClick={() => {
                                  if (import.meta.env?.DEV) {
                                    console.log('[SalesPage] Edit clicked:', { canEditSale, saleId: sale.id, createdBy: (sale as any).created_by, note: 'RLS allows update only when sales.created_by = auth.uid() for salesman' });
                                  }
                                  handleSaleAction('edit', sale);
                                }}
                              >
                                <Edit size={14} className="mr-2 text-green-400" />
                                Edit Sale
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem 
                              className="hover:bg-gray-800 cursor-pointer"
                              onClick={() => handleSaleAction('view_payments', sale)}
                            >
                              <Receipt size={14} className="mr-2 text-blue-400" />
                              View Payments
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="hover:bg-gray-800 cursor-pointer"
                              onClick={() => handleSaleAction('view_ledger', sale)}
                            >
                              <Receipt size={14} className="mr-2 text-blue-400" />
                              View Ledger
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-gray-700" />
                            {/* Share */}
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger className="hover:bg-gray-800 cursor-pointer text-white">
                                <Share2 size={14} className="mr-2 text-green-400" />
                                Share
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent className="bg-gray-900 border-gray-700 text-white">
                                <DropdownMenuItem className="hover:bg-gray-800 cursor-pointer" onClick={() => handleSaleAction('share_whatsapp', sale)}>
                                  Share via WhatsApp
                                </DropdownMenuItem>
                                <DropdownMenuItem className="hover:bg-gray-800 cursor-pointer" onClick={() => handleSaleAction('share_pdf', sale)}>
                                  Share PDF
                                </DropdownMenuItem>
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            {/* Print */}
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger className="hover:bg-gray-800 cursor-pointer text-white">
                                <Printer size={14} className="mr-2 text-purple-400" />
                                Print
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent className="bg-gray-900 border-gray-700 text-white">
                                <DropdownMenuItem className="hover:bg-gray-800 cursor-pointer" onClick={() => handleSaleAction('print_a4', sale)}>
                                  Print A4 (Regular)
                                </DropdownMenuItem>
                                <DropdownMenuItem className="hover:bg-gray-800 cursor-pointer" onClick={() => handleSaleAction('print_thermal', sale)}>
                                  Print Thermal (80mm / 58mm)
                                </DropdownMenuItem>
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            <DropdownMenuItem className="hover:bg-gray-800 cursor-pointer" onClick={() => handleSaleAction('download_pdf', sale)}>
                              <Download size={14} className="mr-2 text-blue-400" />
                              Download PDF
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-gray-700" />
                            {/* 🎯 RECEIVE PAYMENT - Show when payment allowed */}
                            {canAddPaymentToSale(sale, getEffectiveDue(sale)) && (
                              <DropdownMenuItem 
                                className="hover:bg-gray-800 cursor-pointer"
                                onClick={() => handleSaleAction('receive_payment', sale)}
                              >
                                <DollarSign size={14} className="mr-2 text-green-400" />
                                Add Payment
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator className="bg-gray-700" />
                            {/* 🎯 SALE RETURN: Only when final and not cancelled */}
                            {sale.status === 'final' && getEffectiveSaleStatus(sale) !== 'cancelled' && (
                              <>
                                {salesWithReturns.has(sale.id) || sale.hasReturn ? (
                                  <DropdownMenuItem 
                                    className="hover:bg-gray-800 cursor-pointer"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setSelectedSaleForReturns(sale);
                                      setViewReturnsDialogOpen(true);
                                      setLoadingReturns(true);
                                      saleReturnService.getSaleReturns(companyId, branchId === 'all' ? undefined : branchId || undefined)
                                        .then((allReturns) => {
                                          const forSale = allReturns.filter((r: any) => r.original_sale_id === sale.id);
                                          setSaleReturns(forSale);
                                        })
                                        .catch((err: any) => toast.error(err.message || 'Failed to load returns'))
                                        .finally(() => setLoadingReturns(false));
                                    }}
                                  >
                                    <RotateCcw size={14} className="mr-2 text-purple-400" />
                                    View Sale Returns
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem 
                                    className="hover:bg-gray-800 cursor-pointer"
                                    onClick={() => handleSaleAction('create_return', sale)}
                                  >
                                    <RotateCcw size={14} className="mr-2 text-purple-400" />
                                    Create Sale Return
                                  </DropdownMenuItem>
                                )}
                                {/* 🎯 RETURN PAYMENT / ADJUSTMENT - Only if sale has returns */}
                                {(salesWithReturns.has(sale.id) || sale.hasReturn) && (
                                  <DropdownMenuItem 
                                    className="hover:bg-gray-800 cursor-pointer"
                                    onClick={() => handleSaleAction('return_payment', sale)}
                                  >
                                    <DollarSign size={14} className="mr-2 text-green-400" />
                                    Return Payment / Adjustment
                                  </DropdownMenuItem>
                                )}
                              </>
                            )}
                            {sale.hasShipment ? (
                              <DropdownMenuItem 
                                className="hover:bg-gray-800 cursor-pointer"
                                onClick={() => handleSaleAction('update_shipping', sale)}
                              >
                                <Truck size={14} className="mr-2 text-orange-400" />
                                Update Shipping
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem 
                                className="hover:bg-gray-800 cursor-pointer"
                                onClick={() => handleSaleAction('add_shipment', sale)}
                              >
                                <Truck size={14} className="mr-2 text-blue-400" />
                                Add Shipment
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator className="bg-gray-700" />
                            {canCancelSale && sale.status === 'final' && getEffectiveSaleStatus(sale) !== 'cancelled' && (
                              <DropdownMenuItem 
                                className="hover:bg-gray-800 cursor-pointer text-amber-400"
                                onClick={() => handleSaleAction('cancel_invoice', sale)}
                              >
                                <XCircle size={14} className="mr-2" />
                                Cancel Invoice
                              </DropdownMenuItem>
                            )}
                            {canDeleteSale && getEffectiveSaleStatus(sale) !== 'cancelled' && (
                              <DropdownMenuItem 
                                className="hover:bg-gray-800 cursor-pointer text-red-400"
                                onClick={() => handleSaleAction('delete', sale)}
                              >
                                <Trash2 size={14} className="mr-2" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                            </div>
                          );
                        }
                        const alignment = alignments[key] || 'text-left';
                        return (
                          <div
                            key={key}
                            className={cn(
                              alignment,
                              'flex items-center',
                              alignment === 'text-right' && 'justify-end',
                              alignment === 'text-center' && 'justify-center',
                              alignment === 'text-left' && 'justify-start'
                            )}
                          >
                            {renderColumnCell(key, sale)}
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pagination Footer - Fixed */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={totalFilteredCount}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />

      {/* 🎯 VIEW PAYMENTS MODAL */}
      {selectedSale && (
        <ViewPaymentsModal
          isOpen={viewPaymentsOpen}
          onClose={() => {
            setViewPaymentsOpen(false);
            setSelectedSale(null);
          }}
          invoice={{
            id: selectedSale.id,
            invoiceNo: selectedSale.invoiceNo,
            date: selectedSale.date,
            customerName: selectedSale.customerName,
            customerId: selectedSale.customer,
            total: getSaleBillableAmount(selectedSale),
            paid: selectedSale.paid,
            due: getEffectiveDue(selectedSale),
            paymentStatus: selectedSale.paymentStatus,
            payments: [], // Will be fetched dynamically in modal
            referenceType: 'sale',
            // When user can add payment (e.g. opened via Unpaid/Partial badge), ensure Add Payment shows in modal
            status: canAddPaymentToSale(selectedSale, getEffectiveDue(selectedSale)) ? 'final' : selectedSale.status,
          }}
          onAddPayment={() => {
            setViewPaymentsOpen(false);
            setPaymentDialogOpen(true);
          }}
          onEditPayment={(payment) => {
            setPaymentToEdit(payment);
            setViewPaymentsOpen(false);
            setPaymentDialogOpen(true);
          }}
          onDeletePayment={async (paymentId: string) => {
            if (!selectedSale || !paymentId) {
              throw new Error('Sale or Payment ID not found');
            }
            
            try {
              const { saleService } = await import('@/app/services/saleService');
              
              // CRITICAL FIX: Increased timeout to 30 seconds for complex delete operations
              // Delete involves: payment deletion, journal entry reversal, activity logging, balance updates
              const deletePromise = saleService.deletePayment(paymentId, selectedSale.id);
              const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Payment deletion is taking longer than expected. Please wait or try again.')), 30000)
              );
              
              await Promise.race([deletePromise, timeoutPromise]);
              
              // Refresh sales list to get updated totals
              await refreshSales();
              
              // Trigger reload in ViewSaleDetailsDrawer if open
              window.dispatchEvent(new CustomEvent('paymentAdded'));
              
              // Success message already shown in ViewPaymentsModal
            } catch (error: any) {
              console.error('[SALES PAGE] Error deleting payment:', error);
              throw new Error(error?.message || 'Failed to delete payment. Please try again.');
            }
          }}
          onRefresh={async () => {
            await refreshSales();
          }}
        />
      )}

      {/* 🎯 UNIFIED PAYMENT DIALOG (Receive Payment from Customer) */}
      {selectedSale && (
        <UnifiedPaymentDialog
          isOpen={paymentDialogOpen}
          onClose={() => {
            setPaymentDialogOpen(false);
            setPaymentToEdit(null);
            if (!viewPaymentsOpen) setViewPaymentsOpen(true);
          }}
          context="customer"
          entityName={selectedSale.customerName}
          entityId={selectedSale.customer}
          outstandingAmount={getEffectiveDue(selectedSale)}
          totalAmount={getSaleBillableAmount(selectedSale)}
          paidAmount={selectedSale.paid}
          previousPayments={(selectedSale as any).payments || []}
          referenceNo={selectedSale.invoiceNo}
          referenceId={selectedSale.id}
          editMode={!!paymentToEdit}
          paymentToEdit={paymentToEdit ? {
            id: paymentToEdit.id,
            amount: paymentToEdit.amount,
            method: paymentToEdit.method,
            accountId: paymentToEdit.accountId,
            date: paymentToEdit.date,
            referenceNumber: paymentToEdit.referenceNo,
            notes: paymentToEdit.notes,
            attachments: paymentToEdit.attachments,
            parentPaymentId: (paymentToEdit as { parentPaymentId?: string }).parentPaymentId,
          } : undefined}
          onSuccess={async () => {
            toast.success(paymentToEdit ? 'Payment updated successfully' : 'Payment recorded successfully');
            await refreshSales();
            setPaymentDialogOpen(false);
            setPaymentToEdit(null);
            window.dispatchEvent(new CustomEvent('paymentAdded'));
            const customerId = selectedSale?.customer;
            if (customerId) {
              window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'customer', entityId: customerId } }));
            }
            if (!viewDetailsOpen) setViewPaymentsOpen(true);
          }}
        />
      )}

      {/* 🎯 UNIFIED LEDGER VIEW (includes Shipment Accounting when sale has shipments) */}
      {selectedSale && (
        <UnifiedLedgerView
          isOpen={ledgerOpen}
          onClose={() => {
            setLedgerOpen(false);
            setSelectedSale(null);
          }}
          entityType="customer"
          entityName={selectedSale.customerName}
          entityId={selectedSale.id}
          saleId={selectedSale.id}
        />
      )}

      {/* 🎯 SHIPMENT HISTORY DRAWER */}
      <ShipmentHistoryDrawer
        isOpen={shipmentHistoryDrawerOpen}
        onClose={() => {
          setShipmentHistoryDrawerOpen(false);
          setShipmentHistoryShipmentId(null);
          setShipmentHistoryInvoiceNo('');
        }}
        shipmentId={shipmentHistoryShipmentId}
        invoiceNo={shipmentHistoryInvoiceNo}
      />
      
      {/* 🎯 DELETE CONFIRMATION DIALOG */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-gray-900 border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Sale</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              {selectedSale && (
                <>
                  Are you sure you want to delete sale <span className="font-semibold text-white">{selectedSale.invoiceNo}</span>?
                  <br />
                  This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 hover:bg-gray-700 text-white border-gray-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-500 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 🎯 CANCEL INVOICE CONFIRMATION DIALOG */}
      <AlertDialog open={cancelInvoiceDialogOpen} onOpenChange={(open) => { setCancelInvoiceDialogOpen(open); if (!open) setCancelDeductShipping(true); }}>
        <AlertDialogContent className="bg-gray-900 border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Cancel Invoice</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-gray-400 space-y-3">
                {selectedSale && (
                  <>
                    <p>
                      Are you sure you want to cancel invoice <span className="font-semibold text-white">{selectedSale.invoiceNo}</span>?
                      A reversal entry will be created.
                    </p>
                    {(() => {
                      const saleTotal = Number(selectedSale.total) || 0;
                      const alreadyPaid = Number(selectedSale.paid) || 0;
                      const shipping = Number((selectedSale as any).shippingCharges) || 0;
                      const discount = Number((selectedSale as any).discountAmount) || 0;
                      const returnTotal = Number((selectedSale as any).returnTotal) || 0;
                      const returnDiscount = Number((selectedSale as any).returnDiscount) || 0;
                      const netCancelAmount = Math.max(0, saleTotal - returnTotal);
                      const customerRefund = Math.max(0, alreadyPaid - returnTotal - shipping);
                      return (
                        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-3 space-y-1.5 text-sm">
                          <div className="flex justify-between"><span>Sale Total:</span><span className="text-white">Rs. {saleTotal.toLocaleString()}</span></div>
                          {discount > 0 && (
                            <div className="flex justify-between"><span>Discount Given:</span><span className="text-purple-400">Rs. {discount.toLocaleString()}</span></div>
                          )}
                          <div className="flex justify-between"><span>Already Paid:</span><span className="text-white">Rs. {alreadyPaid.toLocaleString()}</span></div>
                          {shipping > 0 && (
                            <div className="flex justify-between"><span>Shipping Charged:</span><span className="text-amber-400">Rs. {shipping.toLocaleString()} <span className="text-xs text-gray-500">(non-refundable)</span></span></div>
                          )}
                          {returnTotal > 0 && (
                            <>
                              <div className="border-t border-gray-700 my-2" />
                              <div className="flex justify-between"><span>Already Returned:</span><span className="text-orange-400">Rs. {returnTotal.toLocaleString()}</span></div>
                              {returnDiscount > 0 && (
                                <div className="flex justify-between text-xs"><span className="text-gray-500">Return Discount Reversed:</span><span className="text-gray-400">Rs. {returnDiscount.toLocaleString()}</span></div>
                              )}
                            </>
                          )}
                          <div className="border-t border-gray-700 my-2" />
                          <div className="flex justify-between"><span>Net Cancel Amount:</span><span className="text-white">Rs. {netCancelAmount.toLocaleString()}</span></div>
                          {shipping > 0 && (
                            <div className="flex justify-between text-xs"><span className="text-gray-500">Less Shipping (non-refundable):</span><span className="text-gray-400">- Rs. {shipping.toLocaleString()}</span></div>
                          )}
                          <div className="flex justify-between font-semibold text-base pt-1">
                            <span>Customer Refund Due:</span>
                            <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">Rs. {customerRefund.toLocaleString()}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 hover:bg-gray-700 text-white border-gray-700" disabled={cancellingInvoice}>
              Keep Invoice
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelInvoice}
              disabled={cancellingInvoice}
              className="bg-amber-600 hover:bg-amber-500 text-white"
            >
              {cancellingInvoice ? 'Cancelling...' : 'Cancel Invoice & Process Refund'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* 🎯 VIEW SALE DETAILS DRAWER */}
      {selectedSale && (
        <ViewSaleDetailsDrawer
          isOpen={viewDetailsOpen}
          onClose={() => {
            setViewDetailsOpen(false);
            setSelectedSale(null);
            setInvoicePrintType(null);
          }}
          saleId={selectedSale.id}
          initialPrintType={invoicePrintType}
          onEdit={() => {
            setViewDetailsOpen(false);
            handleSaleAction('edit', selectedSale);
          }}
          onDelete={() => {
            setViewDetailsOpen(false);
            handleSaleAction('delete', selectedSale);
          }}
          onAddPayment={() => {
            setViewDetailsOpen(false);
            handleSaleAction('receive_payment', selectedSale);
          }}
        />
      )}

      {/* Step 6: Quotations + Proforma */}
      {companyId && (
        <QuotationWorkflow
          companyId={companyId}
          companyName={company?.businessName ?? ''}
          companyAddress={company?.businessAddress ?? null}
          isOpen={showQuotationWorkflow}
          onClose={() => setShowQuotationWorkflow(false)}
          onConvertToSale={async (saleId) => {
            setShowQuotationWorkflow(false);
            await refreshSales();
            const raw = await saleService.getSaleById(saleId).catch(() => null);
            if (raw) {
              const sale = convertFromSupabaseSale(raw);
              setSelectedSale(sale);
              setViewDetailsOpen(true);
            } else {
              toast.success('Quotation converted to sale. Open it from the sales list.');
            }
          }}
        />
      )}

      {/* Wholesale: Bulk Invoice (select packing lists → one invoice) */}
      {companyId && (
        <BulkInvoiceWorkflow
          companyId={companyId}
          companyName={company?.businessName ?? ''}
          companyAddress={company?.businessAddress ?? null}
          isOpen={showBulkInvoiceWorkflow}
          onClose={() => setShowBulkInvoiceWorkflow(false)}
        />
      )}

      {/* 🎯 ADD SHIPMENT – same ShipmentModal as SaleForm (PART 3, PART 4) */}
      {addShipmentSaleId && selectedSale?.id === addShipmentSaleId && companyId && (() => {
        const branchIdForShipment = salesBranchIdMap.get(addShipmentSaleId) ?? (branchId !== 'all' ? branchId : branches[0]?.id);
        if (!branchIdForShipment) return null;
        return (
          <ShipmentModal
            open={true}
            onClose={() => setAddShipmentSaleId(null)}
            saleId={addShipmentSaleId}
            companyId={companyId}
            branchId={branchIdForShipment}
            invoiceNo={selectedSale.invoiceNo}
            onSaved={async () => {
              await refreshSales();
              setAddShipmentSaleId(null);
            }}
            performedBy={user?.id}
          />
        );
      })()}

      {/* 🎯 SALE RETURN FORM (create: saleId only; edit: saleId + returnId for draft) */}
      {saleReturnFormOpen && saleReturnSaleId && (
        <SaleReturnForm
          saleId={saleReturnSaleId}
          returnId={saleReturnEditId}
          onClose={() => {
            setSaleReturnFormOpen(false);
            setSaleReturnSaleId(null);
            setSaleReturnEditId(null);
          }}
          onSuccess={async () => {
            await refreshSales();
            setSaleReturnEditId(null);
            if (companyId) {
              try {
                const returns = await saleReturnService.getSaleReturns(companyId, branchId === 'all' ? undefined : branchId || undefined);
                const saleIdsWithReturns = new Set<string>();
                returns.forEach((ret: any) => {
                  if (ret.original_sale_id && String(ret.status).toLowerCase() === 'final') saleIdsWithReturns.add(ret.original_sale_id);
                });
                setSalesWithReturns(saleIdsWithReturns);
                setSaleReturnsList(returns);
              } catch (error) {
                console.error('[SALES PAGE] Error reloading sales with returns:', error);
              }
            }
          }}
        />
      )}

      {/* 🎯 STANDALONE SALE RETURN (no invoice) */}
      {standaloneReturnFormOpen && (
        <StandaloneSaleReturnForm
          open={standaloneReturnFormOpen}
          onClose={() => setStandaloneReturnFormOpen(false)}
          onSuccess={async () => {
            await refreshSales();
            if (companyId) {
              try {
                const returns = await saleReturnService.getSaleReturns(companyId, branchId === 'all' ? undefined : branchId || undefined);
                const saleIdsWithReturns = new Set<string>();
                returns.forEach((ret: any) => {
                  if (ret.original_sale_id && String(ret.status).toLowerCase() === 'final') saleIdsWithReturns.add(ret.original_sale_id);
                });
                setSalesWithReturns(saleIdsWithReturns);
                setSaleReturnsList(returns);
              } catch (error) {
                console.error('[SALES PAGE] Error reloading returns:', error);
              }
            }
          }}
        />
      )}

      {/* 🎯 RETURN PAYMENT / ADJUSTMENT DIALOG */}
      {returnPaymentDialogOpen && returnPaymentSaleId && (
        <ReturnPaymentAdjustment
          saleId={returnPaymentSaleId}
          isOpen={returnPaymentDialogOpen}
          onClose={() => {
            setReturnPaymentDialogOpen(false);
            setReturnPaymentSaleId(null);
          }}
          onSuccess={async () => {
            await refreshSales();
            await loadSalesWithReturns();
          }}
        />
      )}

      {/* 🎯 UPDATE SHIPPING DIALOG — Courier, Tracking, Status; saves to sale_shipments + shipment_history */}
      <Dialog open={shippingDialogOpen} onOpenChange={(open) => { setShippingDialogOpen(open); if (!open) setUpdateShippingLoadedShipmentId(null); }}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Update Shipping</DialogTitle>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-4">
              <div className="text-sm text-gray-400">
                Invoice: <span className="font-semibold text-blue-400">{selectedSale.invoiceNo}</span>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Courier</Label>
                <Input
                  className="bg-gray-800 border-gray-700 text-white"
                  value={updateShippingForm.courierName}
                  onChange={(e) => setUpdateShippingForm((f) => ({ ...f, courierName: e.target.value }))}
                  placeholder="Courier name"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Tracking Number</Label>
                <Input
                  className="bg-gray-800 border-gray-700 text-white"
                  value={updateShippingForm.trackingId}
                  onChange={(e) => setUpdateShippingForm((f) => ({ ...f, trackingId: e.target.value }))}
                  placeholder="Tracking ID"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Shipment Status</Label>
                <Select
                  value={updateShippingForm.shipmentStatus}
                  onValueChange={(v) => setUpdateShippingForm((f) => ({ ...f, shipmentStatus: v }))}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700">
                    {SHIPMENT_STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt} className="text-white focus:bg-gray-800">
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShippingDialogOpen(false)}
              className="bg-gray-800 hover:bg-gray-700 text-white border-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateShippingSubmit}
              disabled={updateShippingSaving || !selectedSale?.firstShipmentId}
              className="bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              {updateShippingSaving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 🎯 VIEW SALE RETURNS DIALOG */}
      <Dialog open={viewReturnsDialogOpen} onOpenChange={setViewReturnsDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <RotateCcw size={20} className="text-purple-400" />
              Sale Returns for {selectedSaleForReturns?.invoiceNo}
            </DialogTitle>
          </DialogHeader>
          {loadingReturns ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin text-blue-400" size={24} />
            </div>
          ) : saleReturns.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              No returns found for this sale.
            </div>
          ) : (
            <div className="space-y-4">
              {saleReturns.map((ret: any) => (
                <div key={ret.id} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">Return #{ret.return_no || ret.id?.slice(0, 8)}</span>
                        <Badge
                          className={
                            String(ret?.status).toLowerCase() === 'void'
                              ? 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                              : ret.status === 'final'
                                ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                          }
                        >
                          {String(ret?.status).toLowerCase() === 'void'
                            ? 'VOID / LOCKED'
                            : ret.status === 'final'
                              ? 'FINAL / LOCKED'
                              : ret.status || 'Draft'}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        Date: {(() => {
                          const dt = formatDateAndTime(ret.return_date || ret.created_at);
                          return `${dt.date} ${dt.time}`;
                        })()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-red-400">-Rs. {ret.total?.toLocaleString() || '0'}</p>
                    </div>
                  </div>
                  {ret.items && ret.items.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-700">
                      <p className="text-xs text-gray-500 mb-2">Returned Items:</p>
                      <div className="space-y-1">
                        {ret.items.map((item: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <span className="text-gray-300">{item.product_name} {item.sku ? `(${item.sku})` : ''}</span>
                            <span className="text-gray-400">Qty: {item.quantity} × Rs. {item.unit_price?.toLocaleString() || '0'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {ret.reason && (
                    <div className="mt-2 pt-2 border-t border-gray-700">
                      <p className="text-xs text-gray-500">Reason:</p>
                      <p className="text-sm text-gray-300">{ret.reason}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setViewReturnsDialogOpen(false)}
              className="bg-gray-800 hover:bg-gray-700 text-white border-gray-700"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 🎯 ATTACHMENTS VIEWER - Shared Component */}
      {attachmentsDialogList && (
        <AttachmentViewer
          attachments={attachmentsDialogList}
          isOpen={!!attachmentsDialogList}
          onClose={() => setAttachmentsDialogList(null)}
        />
      )}

      {/* View Return Details Dialog */}
      {selectedReturn && (
        <Dialog open={viewReturnDetailsOpen} onOpenChange={setViewReturnDetailsOpen}>
          <DialogContent className="bg-[#0B0F19] border-gray-800 text-white !w-[800px] !max-w-[800px] sm:!max-w-[800px] max-h-[90vh] overflow-y-auto">
            <DialogHeader className="border-b border-gray-800 pb-4">
              <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <RotateCcw size={20} className="text-purple-400" />
                </div>
                <div>
                  <div>Return Details</div>
                  <div className="text-sm font-mono text-purple-400 font-normal">{selectedReturn.return_no || `RET-${selectedReturn.id?.slice(0, 8).toUpperCase()}`}</div>
                </div>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6 mt-4">
              {/* Return Header Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-[#0F1419] rounded-lg border border-gray-800">
                <div>
                  <p className="text-xs text-gray-400 uppercase mb-1">Return Date</p>
                  <p className="text-sm text-white font-medium">{formatDateAndTime(selectedReturn.return_date || selectedReturn.created_at).date} {formatDateAndTime(selectedReturn.return_date || selectedReturn.created_at).time}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase mb-1">Status</p>
                  <Badge className={selectedReturn.status === 'final' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'}>
                    {selectedReturn.status === 'final' ? 'FINAL / LOCKED' : 'Draft'}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase mb-1">Customer</p>
                  <p className="text-sm text-white font-medium">{selectedReturn.customer_name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase mb-1">Location</p>
                  <p className="text-sm text-white">{branchMap.get(selectedReturn.branch_id) || '—'}</p>
                </div>
                {selectedReturn.original_sale_id && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase mb-1">Original Sale</p>
                    <button
                      onClick={() => {
                        const sale = sales.find(s => s.id === selectedReturn.original_sale_id);
                        if (sale) {
                          setViewReturnDetailsOpen(false);
                          setSelectedSale(sale);
                          setViewDetailsOpen(true);
                        }
                      }}
                      className="text-sm text-blue-400 hover:text-blue-300 hover:underline font-mono"
                    >
                      {sales.find(s => s.id === selectedReturn.original_sale_id)?.invoiceNo || `Sale ID: ${selectedReturn.original_sale_id.slice(0, 8)}`}
                    </button>
                  </div>
                )}
                {selectedReturn.reason && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-400 uppercase mb-1">Reason</p>
                    <p className="text-sm text-white">{selectedReturn.reason}</p>
                  </div>
                )}
                {selectedReturn.notes && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-400 uppercase mb-1">Notes</p>
                    <p className="text-sm text-gray-300">{selectedReturn.notes}</p>
                  </div>
                )}
              </div>

              {/* Return Items */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Return Items</h3>
                {selectedReturn.items && selectedReturn.items.length > 0 ? (
                  <div className="bg-[#0F1419] border border-gray-800 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-[#0B0F19] border-b border-gray-800">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Product</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">SKU</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Qty</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Unit Price</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {selectedReturn.items.map((item: any, idx: number) => (
                          <tr key={idx} className="hover:bg-[#0B0F19] transition-colors">
                            <td className="px-4 py-3 text-sm text-white">{item.product_name}</td>
                            <td className="px-4 py-3 text-sm text-gray-400 font-mono">{item.sku}</td>
                            <td className="px-4 py-3 text-sm text-gray-300 text-center">{item.quantity}</td>
                            <td className="px-4 py-3 text-sm text-gray-300 text-right tabular-nums">Rs. {item.unit_price?.toLocaleString() || '0'}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-red-400 text-right tabular-nums">-Rs. {item.total?.toLocaleString() || '0'}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-[#0B0F19] border-t border-gray-800">
                        <tr>
                          <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-gray-300 text-right">Total Return Amount:</td>
                          <td className="px-4 py-3 text-lg font-bold text-red-400 text-right tabular-nums">-Rs. {selectedReturn.total?.toLocaleString() || '0'}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <Package size={48} className="mx-auto mb-3 text-gray-600" />
                    <p>No items found in this return</p>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter className="mt-6 border-t border-gray-800 pt-4">
              <Button
                variant="outline"
                onClick={() => setViewReturnDetailsOpen(false)}
                className="border-gray-800 text-gray-300 hover:text-white hover:bg-gray-800"
              >
                Close
              </Button>
              <Button
                onClick={async () => {
                  if (!selectedSale) return;
                  try {
                    const returns = await saleReturnService.getSaleReturns(companyId, branchId === 'all' ? undefined : branchId || undefined);
                    const saleReturns = returns.filter(r => r.original_sale_id === selectedSale.id);
                    if (saleReturns.length > 0) {
                      const fullReturn = await saleReturnService.getSaleReturnById(saleReturns[0].id, companyId);
                      setSelectedReturnForPrint(fullReturn);
                      setPrintReturnOpen(true);
                    } else {
                      toast.error('No returns found for this sale');
                    }
                  } catch (error: any) {
                    console.error('[SalesPage] Error loading return for print:', error);
                    toast.error('Could not load return details for printing');
                  }
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Printer size={16} className="mr-2" />
                Print Return
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Return Confirmation Dialog */}
      <AlertDialog open={deleteReturnDialogOpen} onOpenChange={setDeleteReturnDialogOpen}>
        <AlertDialogContent className="bg-gray-900 border-gray-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Return?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300">
              Are you sure you want to delete return <span className="font-semibold text-white">{returnToDelete?.return_no || `RET-${returnToDelete?.id?.slice(0, 8).toUpperCase()}`}</span>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!returnToDelete || !companyId) return;
                try {
                  await saleReturnService.deleteSaleReturn(returnToDelete.id, companyId);
                  toast.success('Return deleted successfully');
                  setDeleteReturnDialogOpen(false);
                  setReturnToDelete(null);
                  const returns = await saleReturnService.getSaleReturns(companyId, branchId === 'all' ? undefined : branchId || undefined);
                  setSaleReturnsList(returns);
                  const saleIdsWithReturns = new Set<string>();
                  returns.forEach((r: any) => {
                    if (r.original_sale_id && String(r.status).toLowerCase() === 'final') saleIdsWithReturns.add(r.original_sale_id);
                  });
                  setSalesWithReturns(saleIdsWithReturns);
                } catch (error: any) {
                  toast.error(error.message || 'Failed to delete return');
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Void Return Confirmation Dialog — standard method when return was saved by mistake */}
      <AlertDialog open={voidReturnDialogOpen} onOpenChange={(open) => { setVoidReturnDialogOpen(open); if (!open) setReturnToVoid(null); }}>
        <AlertDialogContent className="bg-gray-900 border-gray-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Void / Cancel Return?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300">
              This will <span className="font-semibold text-amber-400">void / cancel</span> return{' '}
              <span className="font-semibold text-white">{returnToVoid?.return_no || `RET-${returnToVoid?.id?.slice(0, 8).toUpperCase()}`}</span>
              — same idea as purchase returns: stock is reversed (goods go back out as if the return did not land), settlement is reversed in the ledger where posted, and the document is marked{' '}
              <span className="font-semibold text-gray-200">void</span> and <span className="font-semibold text-gray-200">locked</span> (no edit / no delete; audit trail kept). Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800" disabled={voidingReturn}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!returnToVoid || !companyId) return;
                setVoidingReturn(true);
                try {
                  const vr = await saleReturnService.voidSaleReturn(
                    returnToVoid.id,
                    companyId,
                    branchId === 'all' ? undefined : branchId,
                    undefined
                  );
                  if (vr.alreadyVoided) {
                    toast.message('Return already cancelled — no further action applied.');
                  } else {
                    toast.success('Return voided successfully. Stock reversed and settlement posted to the ledger.');
                  }
                  setVoidReturnDialogOpen(false);
                  setReturnToVoid(null);
                  const returns = await saleReturnService.getSaleReturns(companyId, branchId === 'all' ? undefined : branchId || undefined);
                  setSaleReturnsList(returns);
                  const saleIdsWithReturns = new Set<string>();
                  returns.forEach((r: any) => {
                    if (r.original_sale_id && String(r.status).toLowerCase() === 'final') saleIdsWithReturns.add(r.original_sale_id);
                  });
                  setSalesWithReturns(saleIdsWithReturns);
                } catch (error: any) {
                  toast.error(error.message || 'Failed to void return');
                } finally {
                  setVoidingReturn(false);
                }
              }}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {voidingReturn ? 'Voiding…' : 'Void Return'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sale Return Print Dialog */}
      {selectedReturnForPrint && printReturnOpen && (
        <SaleReturnPrintLayout
          saleReturn={selectedReturnForPrint}
          onClose={() => {
            setPrintReturnOpen(false);
            setSelectedReturnForPrint(null);
          }}
        />
      )}
    </div>
  );
};