import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Plus, ShoppingBag, DollarSign, AlertCircle, 
  MoreVertical, Eye, Edit, Trash2, FileText, Phone, MapPin,
  Package, CheckCircle, Clock, XCircle, Receipt, ChevronDown, ChevronUp,
  Paperclip, RotateCcw, Printer, Download
} from 'lucide-react';
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
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
import { cn } from "@/app/components/ui/utils";
import { useNavigation } from '@/app/context/NavigationContext';
import { usePurchases } from '@/app/context/PurchaseContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useDateRange } from '@/app/context/DateRangeContext';
import { purchaseService } from '@/app/services/purchaseService';
import { branchService, Branch } from '@/app/services/branchService';
import { Pagination } from '@/app/components/ui/pagination';
import { ListToolbar } from '@/app/components/ui/list-toolbar';
import { formatDateAndTime } from '@/app/components/ui/utils';
import { UnifiedPaymentDialog } from '@/app/components/shared/UnifiedPaymentDialog';
import { UnifiedLedgerView } from '@/app/components/shared/UnifiedLedgerView';
import { ViewPurchaseDetailsDrawer } from './ViewPurchaseDetailsDrawer';
import { ViewPaymentsModal, type InvoiceDetails, type Payment } from '@/app/components/sales/ViewPaymentsModal';
import { AttachmentViewer } from '@/app/components/shared/AttachmentViewer';
import { PurchaseReturnPrintLayout } from '@/app/components/shared/PurchaseReturnPrintLayout';
import { purchaseReturnService } from '@/app/services/purchaseReturnService';
import { PurchaseReturnForm } from './PurchaseReturnForm';
import { StandalonePurchaseReturnForm } from './StandalonePurchaseReturnForm';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/app/components/ui/dialog';
import { toast } from 'sonner';
import { useCheckPermission } from '@/app/hooks/useCheckPermission';

type PurchaseStatus = 'received' | 'ordered' | 'pending' | 'final' | 'draft';
type PaymentStatus = 'paid' | 'partial' | 'unpaid';

interface Purchase {
  id: number; // Display ID (index-based for UI compatibility)
  uuid: string; // Actual Supabase UUID for database operations
  poNo: string;
  supplier: string;
  supplierContact: string;
  date: string;
  reference: string;
  location: string;
  items: number;
  grandTotal: number;
  paymentDue: number;
  status: PurchaseStatus;
  paymentStatus: PaymentStatus;
  addedBy: string;
  attachments?: { url: string; name: string }[] | null; // Purchase attachments
  hasReturn?: boolean;
  returnCount?: number;
}

// Mock data removed - using purchaseService which loads from Supabase

export const PurchasesPage = () => {
  const { openDrawer } = useNavigation();
  const { companyId, branchId } = useSupabase();
  const { canDeletePurchase } = useCheckPermission();
  const { startDate, endDate } = useDateRange();
  const { purchases: contextPurchases, loading: contextLoading, refreshPurchases, deletePurchase } = usePurchases();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchMap, setBranchMap] = useState<Map<string, string>>(new Map());
  
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
      } catch (error) {
        console.error('[PURCHASES PAGE] Error loading branches:', error);
      }
    };
    loadBranches();
  }, [companyId]);
  
  // Filter states
  const [dateFilter, setDateFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');

  // Check for supplier filter from ContactsPage
  useEffect(() => {
    const supplierId = sessionStorage.getItem('purchasesFilter_supplierId');
    const supplierName = sessionStorage.getItem('purchasesFilter_supplierName');
    if (supplierId) {
      setSupplierFilter(supplierId);
      sessionStorage.removeItem('purchasesFilter_supplierId');
      sessionStorage.removeItem('purchasesFilter_supplierName');
      if (supplierName) {
        toast.info(`Filtering purchases for ${supplierName}`);
      }
    }
  }, []);
  const [statusFilter, setStatusFilter] = useState<'all' | PurchaseStatus>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | PaymentStatus>('all');
  const [branchFilter, setBranchFilter] = useState('all');

  // ✅ Action States for Unified Components
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [viewDetailsOpen, setViewDetailsOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  // STEP 2 FIX: View Payments Modal state (like Sale module)
  const [viewPaymentsOpen, setViewPaymentsOpen] = useState(false);
  
  // State for viewing attachments
  const [attachmentsDialogList, setAttachmentsDialogList] = useState<{ url: string; name: string }[] | null>(null);
  // Purchase Returns list
  const [purchaseReturnsList, setPurchaseReturnsList] = useState<any[]>([]);
  const [purchaseReturnsDialogOpen, setPurchaseReturnsDialogOpen] = useState(false);
  const [loadingPurchaseReturns, setLoadingPurchaseReturns] = useState(false);
  const [selectedPurchaseReturn, setSelectedPurchaseReturn] = useState<any | null>(null);
  const [viewPurchaseReturnDetailsOpen, setViewPurchaseReturnDetailsOpen] = useState(false);
  const [purchaseReturnToDelete, setPurchaseReturnToDelete] = useState<any | null>(null);
  const [deletePurchaseReturnDialogOpen, setDeletePurchaseReturnDialogOpen] = useState(false);
  const [voidPurchaseReturnDialogOpen, setVoidPurchaseReturnDialogOpen] = useState(false);
  const [returnToVoidPurchase, setReturnToVoidPurchase] = useState<any | null>(null);
  const [voidingPurchaseReturn, setVoidingPurchaseReturn] = useState(false);
  const [selectedReturnForPrint, setSelectedReturnForPrint] = useState<any | null>(null);
  const [printReturnOpen, setPrintReturnOpen] = useState(false);

  // Purchase Return Form (from invoice)
  const [purchaseReturnFormOpen, setPurchaseReturnFormOpen] = useState(false);
  const [selectedPurchaseForReturn, setSelectedPurchaseForReturn] = useState<Purchase | null>(null);
  const [purchasesWithReturns, setPurchasesWithReturns] = useState<Set<string>>(new Set());
  /** Standalone purchase return (no invoice) form */
  const [standalonePurchaseReturnFormOpen, setStandalonePurchaseReturnFormOpen] = useState(false);

  /** Main tab: Purchases (with status sub-tabs) | Returns */
  const [activeMainTab, setActiveMainTab] = useState<'purchases' | 'returns'>('purchases');
  /** When set, open View Purchase drawer for this ID (e.g. from "View Original Purchase" on a return) */
  const [originalPurchaseIdToView, setOriginalPurchaseIdToView] = useState<string | null>(null);

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState({
    date: true,
    poNo: true,
    reference: true,
    supplier: true,
    location: true,
    status: true,
    items: true,
    grandTotal: true,
    paymentDue: true,
    paymentStatus: true,
    addedBy: true,
  });

  // ✅ Action Handlers
  // STEP 2 FIX: Payment click handler - show ViewPaymentsModal first (like Sale module)
  const handleMakePayment = (purchase: Purchase) => {
    setSelectedPurchase(purchase);
    // First show payment history modal
    setViewPaymentsOpen(true);
  };

  // Handle Add Payment from ViewPaymentsModal
  const handleAddPaymentFromModal = () => {
    setViewPaymentsOpen(false);
    setIsPaymentDialogOpen(true);
  };

  const handleViewLedger = (purchase: Purchase) => {
    setSelectedPurchase(purchase);
    setIsLedgerOpen(true);
  };

  const handlePaymentComplete = async () => {
    setIsPaymentDialogOpen(false);
    setSelectedPurchase(null);
    await loadPurchases(); // Refresh purchases list
  };

  const handlePrintPO = (purchase: Purchase) => {
    // Open view details drawer which has print layout
    setSelectedPurchase(purchase);
    setViewDetailsOpen(true);
    toast.info(`Opening PO ${purchase.poNo} for printing`);
  };

  const handleDelete = (purchase: Purchase) => {
    setSelectedPurchase(purchase);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedPurchase || !selectedPurchase.uuid) {
      toast.error('Purchase ID not found');
      return;
    }
    
    try {
      // Use context delete which handles state refresh
      await deletePurchase(selectedPurchase.uuid);
      toast.success(`Purchase ${selectedPurchase.poNo} deleted successfully`);
      setDeleteDialogOpen(false);
      setSelectedPurchase(null);
      
      // CRITICAL: Refresh both context and local state
      await refreshPurchases();
      await loadPurchases();
    } catch (error: any) {
      console.error('[PURCHASES PAGE] Error deleting purchase:', error);
      toast.error('Failed to delete purchase: ' + (error.message || 'Unknown error'));
      // Refresh on error to ensure UI consistency
      await refreshPurchases();
      await loadPurchases();
    }
  };

  const handleViewDetails = (purchase: Purchase) => {
    setSelectedPurchase(purchase);
    setViewDetailsOpen(true);
  };

  // Handle purchase actions (edit, delete, make_payment)
  const handlePurchaseAction = (action: 'edit' | 'delete' | 'make_payment', purchase: Purchase) => {
    setSelectedPurchase(purchase);
    switch (action) {
      case 'edit':
        // TODO: Implement edit functionality
        toast.info('Edit purchase functionality coming soon');
        break;
      case 'delete':
        setDeleteDialogOpen(true);
        break;
      case 'make_payment':
        setIsPaymentDialogOpen(true);
        break;
    }
  };

  const handleEdit = (purchase: Purchase) => {
    openDrawer('edit-purchase', undefined, { purchase });
  };

  // Load purchases from Supabase
  const loadPurchases = useCallback(async () => {
    if (!companyId) return;
    
    try {
      setLoading(true);
      const data = await purchaseService.getAllPurchases(companyId, branchId === 'all' ? undefined : branchId || undefined);
      
      // Convert Supabase format to app format
      const convertedPurchases: Purchase[] = data.map((p: any, index: number) => {
        // 🔒 CLONE FROM SALE PAGE: Resolve branch NAME from branch_id (UI rule: name only, no code, no UUID)
        let location = '';
        if (p.branch?.name) {
          location = p.branch.name;
        } else if (p.branch_id) {
          // Always try to resolve from branchMap (even if empty, will be resolved in render)
          const resolved = branchMap.get(p.branch_id);
          if (resolved) {
            // Extract just the name if branchMap returns "BR-001 | Name" format
            location = resolved.includes('|') ? resolved.split('|').pop()?.trim() || '' : resolved;
          } else {
            // If branchMap not loaded yet, store branch_id (will be resolved in render)
            location = p.branch_id;
          }
        }
        
        return {
          id: index + 1, // Use index-based ID for compatibility with existing UI
          uuid: p.id, // Store actual Supabase UUID for database operations
          poNo: p.po_no || `PO-${String(index + 1).padStart(3, '0')}`,
          supplier: p.supplier?.name || p.supplier_name || 'Unknown Supplier',
          supplierContact: p.supplier?.phone || '',
          date: p.po_date || new Date().toISOString().split('T')[0],
          // STEP 1 FIX: Reference number from notes field (reference field may not exist in all schemas)
          reference: p.reference || p.notes || '',
          location: location,
          items: p.items?.length || 0,
          grandTotal: p.total || 0,
          paymentDue: p.due_amount || 0,
          // Preserve API status for tabs: draft | ordered | received | final
          status: (p.status === 'final' ? 'final' : 
                   p.status === 'received' ? 'received' : 
                   p.status === 'ordered' ? 'ordered' : 
                   p.status === 'draft' ? 'draft' : 
                   'draft') as PurchaseStatus,
          paymentStatus: p.payment_status || 'unpaid',
          // STEP 3 FIX: Added By - show user name from created_by_user join or Purchase.createdBy
          addedBy: p.created_by_user?.full_name || p.created_by_user?.email || (p as any).createdBy || 'System',
          // Attachments from purchase
          attachments: p.attachments || null,
          // 🔒 LOCK CHECK: hasReturn and returnCount from API
          hasReturn: p.hasReturn || false,
          returnCount: p.returnCount || 0,
        };
      });
      
      setPurchases(convertedPurchases);
    } catch (error: any) {
      console.error('[PURCHASES PAGE] Error loading purchases:', error);
      toast.error('Failed to load purchases: ' + (error.message || 'Unknown error'));
      setPurchases([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId, branchMap]);

  // Sync context purchases to local state for filtering (TASK 1 FIX - Ensure data loads on mount)
  useEffect(() => {
    if (contextPurchases.length > 0) {
      const convertedPurchases: Purchase[] = contextPurchases.map((p: any, index: number) => {
        // 🔒 CLONE FROM SALE PAGE: UI Rule: Show branch NAME only (never UUID, never code)
        // p.location from context should already be branch name, but resolve if needed
        let locationDisplay = p.location || '';
        
        // Safety check: if somehow UUID got through, try to resolve it
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(locationDisplay);
        if (isUUID) {
          const resolved = branchMap.get(locationDisplay);
          // Extract just the name if branchMap returns "BR-001 | Name" format
          if (resolved && resolved.includes('|')) {
            locationDisplay = resolved.split('|').pop()?.trim() || '';
          } else {
            locationDisplay = resolved || '';
          }
        }
        // Strip code prefix if present (e.g., "BR-001 | Name" -> "Name")
        if (locationDisplay.includes('|')) {
          locationDisplay = locationDisplay.split('|').pop()?.trim() || '';
        }
        
        return {
          id: index + 1,
          uuid: p.id,
          poNo: p.purchaseNo || `PO-${String(index + 1).padStart(3, '0')}`,
          supplier: p.supplierName || 'Unknown Supplier',
          supplierContact: p.contactNumber || '',
          date: p.date || new Date().toISOString().split('T')[0],
          // STEP 1 FIX: Reference number from notes field
          reference: p.notes || '',
          location: locationDisplay,
          items: p.itemsCount || 0,
          grandTotal: p.total || 0,
          paymentDue: p.due || 0,
          // Preserve API status for tabs: draft | ordered | received | final
          status: (p.status === 'final' ? 'final' : 
                   p.status === 'received' ? 'received' : 
                   p.status === 'ordered' ? 'ordered' : 
                   p.status === 'draft' ? 'draft' : 
                   'draft') as PurchaseStatus,
          paymentStatus: p.paymentStatus || 'unpaid',
          // STEP 3 FIX: Added By - show user name from created_by_user join (context purchases)
          addedBy: (p as any).createdBy || p.created_by_user?.full_name || p.created_by_user?.email || 'System',
          // Attachments from purchase
          attachments: p.attachments || null,
        };
      });
      setPurchases(convertedPurchases);
      setLoading(contextLoading);
    } else if (!contextLoading && companyId) {
      // Fallback: load directly if context is empty (TASK 1 FIX)
      loadPurchases();
    } else {
      setLoading(contextLoading);
    }
  }, [contextPurchases, contextLoading, companyId, loadPurchases, branchMap]);

  // TASK 1 FIX - Ensure initial load happens even if context is empty
  useEffect(() => {
    if (companyId && purchases.length === 0 && !loading && !contextLoading) {
      // Force load if no data and not loading
      loadPurchases();
    }
  }, [companyId, purchases.length, loading, contextLoading, loadPurchases]);

  // Listen for purchase saved event to refresh list
  useEffect(() => {
    const handlePurchaseSaved = () => {
      loadPurchases();
      if (refreshPurchases) refreshPurchases();
    };
    const handlePaymentAdded = () => {
      loadPurchases();
      if (refreshPurchases) refreshPurchases();
    };
    window.addEventListener('purchaseSaved', handlePurchaseSaved);
    window.addEventListener('paymentAdded', handlePaymentAdded);
    return () => {
      window.removeEventListener('purchaseSaved', handlePurchaseSaved);
      window.removeEventListener('paymentAdded', handlePaymentAdded);
    };
  }, [loadPurchases, refreshPurchases]);
  
  // Load purchase returns list when Returns tab is active
  useEffect(() => {
    if (activeMainTab === 'returns' && companyId) {
      setLoadingPurchaseReturns(true);
      purchaseReturnService.getPurchaseReturns(companyId, branchId === 'all' ? undefined : branchId)
        .then((list) => {
          setPurchaseReturnsList(list);
          setLoadingPurchaseReturns(false);
        })
        .catch(() => setLoadingPurchaseReturns(false));
    }
  }, [activeMainTab, companyId, branchId]);

  // Load purchases with returns
  useEffect(() => {
    const loadPurchasesWithReturns = async () => {
      if (!companyId) return;
      try {
        const returns = await purchaseReturnService.getPurchaseReturns(companyId, branchId === 'all' ? undefined : branchId);
        const returnPurchaseIds = new Set(returns.map((r: any) => r.original_purchase_id).filter(Boolean));
        setPurchasesWithReturns(returnPurchaseIds);
      } catch (error) {
        console.error('[PURCHASES PAGE] Error loading purchase returns:', error);
      }
    };
    loadPurchasesWithReturns();
  }, [companyId, branchId]);
  
  // 🔒 CLONE FROM SALE PAGE: Re-resolve locations when branchMap is updated
  useEffect(() => {
    if (branchMap.size > 0 && purchases.length > 0) {
      // Re-resolve locations for purchases that might have UUIDs
      const updatedPurchases = purchases.map(p => {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.location);
        if (isUUID) {
          const resolved = branchMap.get(p.location);
          if (resolved) {
            const locationName = resolved.includes('|') ? resolved.split('|').pop()?.trim() || '' : resolved;
            return { ...p, location: locationName };
          }
        }
        return p;
      });
      // Only update if locations actually changed
      const hasChanges = updatedPurchases.some((p, i) => p.location !== purchases[i].location);
      if (hasChanges) {
        setPurchases(updatedPurchases);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchMap]); // Only depend on branchMap, not purchases (to avoid infinite loop)

  // Column alignments - shared between header and data cells
  const alignments: Record<string, string> = {
    date: 'text-left',
    poNo: 'text-left',
    reference: 'text-left',
    supplier: 'text-left',
    location: 'text-left',
    status: 'text-center',
    items: 'text-center',
    grandTotal: 'text-right',
    paymentDue: 'text-right',
    paymentStatus: 'text-center',
    addedBy: 'text-left',
  };

  // Column order state - defines order of columns (same as Sale/Products; reorder in Columns dropdown)
  const [columnOrder, setColumnOrder] = useState([
    'date', 'poNo', 'reference', 'supplier', 'location', 'status', 'items',
    'grandTotal', 'paymentDue', 'paymentStatus', 'addedBy',
  ]);

  // Columns configuration for Column Manager - ordered by columnOrder (reorder via Move Up/Down)
  const columnLabels: Record<string, string> = {
    date: 'Date',
    poNo: 'PO Number',
    reference: 'Reference',
    supplier: 'Supplier',
    location: 'Location',
    status: 'Purchase Status',
    items: 'Items',
    grandTotal: 'Grand Total',
    paymentDue: 'Payment Due',
    paymentStatus: 'Payment Status',
    addedBy: 'Added By',
  };
  const columns = columnOrder.map(key => ({ key, label: columnLabels[key] || key }));

  const toggleColumn = (key: string) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key as keyof typeof visibleColumns] }));
  };

  const moveColumnUp = (key: string) => {
    const index = columnOrder.indexOf(key);
    if (index > 0) {
      const newOrder = [...columnOrder];
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
      setColumnOrder(newOrder);
    }
  };

  const moveColumnDown = (key: string) => {
    const index = columnOrder.indexOf(key);
    if (index < columnOrder.length - 1) {
      const newOrder = [...columnOrder];
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      setColumnOrder(newOrder);
    }
  };

  const getColumnWidth = (key: string): string => {
    const widths: Record<string, string> = {
      date: '100px', poNo: '110px', reference: '110px', supplier: '200px', location: '150px',
      status: '130px', items: '80px', grandTotal: '120px', paymentDue: '120px',
      paymentStatus: '130px', addedBy: '130px',
    };
    return widths[key] || '100px';
  };

  const gridTemplateColumns = useMemo(() => {
    const parts = columnOrder
      .filter(key => visibleColumns[key as keyof typeof visibleColumns])
      .map(key => getColumnWidth(key));
    return `${parts.join(' ')} 60px`.trim();
  }, [columnOrder, visibleColumns]);

  // Filter data by date range (TASK 1 FIX - "All" means no date filter)
  const filterByDateRange = useCallback((dateStr: string | undefined): boolean => {
    // TASK 1 FIX - If no date range selected, show all (no filter)
    if (!startDate && !endDate) return true;
    if (!dateStr) return false;
    
    const date = new Date(dateStr);
    if (startDate && date < new Date(startDate)) return false;
    if (endDate && date > new Date(endDate + 'T23:59:59')) return false;
    return true;
  }, [startDate, endDate]);

  // Filtered purchases
  const filteredPurchases = useMemo(() => {
    return purchases.filter(purchase => {
      // Date range filter (from global date range context)
      if (!filterByDateRange(purchase.date)) return false;

      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesSearch = 
          purchase.poNo.toLowerCase().includes(search) ||
          purchase.supplier.toLowerCase().includes(search) ||
          purchase.reference.toLowerCase().includes(search) ||
          purchase.location.toLowerCase().includes(search);
        if (!matchesSearch) return false;
      }

      // Date filter (local filter - can be removed if using global date range only)
      if (dateFilter !== 'all') {
        // Add date filter logic here
      }

      // Supplier filter (TASK 2 FIX - "all" means no filter)
      if (supplierFilter !== 'all' && purchase.supplier !== supplierFilter && purchase.uuid !== supplierFilter) return false;

      // Status filter
      if (statusFilter !== 'all' && purchase.status !== statusFilter) return false;

      // Payment status filter
      if (paymentStatusFilter !== 'all' && purchase.paymentStatus !== paymentStatusFilter) return false;

      // Branch filter
      if (branchFilter !== 'all' && purchase.location !== branchFilter) return false;

      return true;
    });
  }, [purchases, searchTerm, dateFilter, supplierFilter, statusFilter, paymentStatusFilter, branchFilter, filterByDateRange]);

  // Sort state: default date descending (latest first)
  type PurchaseSortKey = keyof Purchase;
  const [sortKey, setSortKey] = useState<PurchaseSortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const getPurchaseSortValue = (p: Purchase, key: PurchaseSortKey): string | number => {
    const v = (p as any)[key];
    if (key === 'date' && typeof v === 'string') return new Date(v).getTime();
    if (typeof v === 'number') return v;
    return String(v ?? '');
  };

  const sortedPurchases = useMemo(() => {
    return [...filteredPurchases].sort((a, b) => {
      const va = getPurchaseSortValue(a, sortKey);
      const vb = getPurchaseSortValue(b, sortKey);
      const cmp = typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filteredPurchases, sortKey, sortDir]);

  const handleSort = (key: PurchaseSortKey) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
    setCurrentPage(1);
  };

  // Calculate summary
  const summary = useMemo(() => ({
    totalPurchase: sortedPurchases.reduce((sum, p) => sum + p.grandTotal, 0),
    totalDue: sortedPurchases.reduce((sum, p) => sum + p.paymentDue, 0),
    returns: 2500, // Mock value
    orderCount: sortedPurchases.length,
  }), [sortedPurchases]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
  // Paginated purchases (from sorted list)
  const paginatedPurchases = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return sortedPurchases.slice(startIndex, endIndex);
  }, [sortedPurchases, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedPurchases.length / pageSize);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, dateFilter, supplierFilter, statusFilter, paymentStatusFilter, branchFilter]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const clearAllFilters = () => {
    setDateFilter('all');
    setSupplierFilter('all');
    setStatusFilter('all');
    setPaymentStatusFilter('all');
    setBranchFilter('all');
  };

  const activeFilterCount = [
    dateFilter !== 'all',
    supplierFilter !== 'all',
    statusFilter !== 'all',
    paymentStatusFilter !== 'all',
    branchFilter !== 'all',
  ].filter(Boolean).length;

  // STEP 1 FIX: Status badge with proper mapping
  // Final → Final (green), Received → Received (green), Draft/Ordered → Pending (yellow)
  const getPurchaseStatusBadge = (status: PurchaseStatus) => {
    const config: Record<string, { bg: string; text: string; border: string; icon: any; label: string }> = {
      final: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', icon: CheckCircle, label: 'Final' },
      received: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', icon: CheckCircle, label: 'Received' },
      pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30', icon: AlertCircle, label: 'Pending' },
      ordered: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', icon: Clock, label: 'Ordered' },
      draft: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30', icon: AlertCircle, label: 'Draft' },
    };
    const { bg, text, border, icon: Icon, label } = config[status] || config.pending;
    return (
      <Badge className={cn('text-xs font-medium capitalize gap-1 h-6 px-2', bg, text, border)}>
        <Icon size={12} />
        {label}
      </Badge>
    );
  };

  const getPaymentStatusBadge = (status: PaymentStatus) => {
    const config = {
      paid: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
      partial: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
      unpaid: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
    };
    const { bg, text, border } = config[status];
    return (
      <Badge className={cn('text-xs font-medium capitalize h-6 px-2', bg, text, border)}>
        {status}
      </Badge>
    );
  };

  const renderPurchaseCell = (purchase: Purchase, key: string): React.ReactNode => {
    switch (key) {
      case 'date': {
        const dateTime = formatDateAndTime(purchase.date);
        return (
          <div className="flex flex-col text-sm text-gray-400">
            <span>{dateTime.date}</span>
            <span className="text-xs text-gray-500">{dateTime.time}</span>
          </div>
        );
      }
      case 'poNo':
        return <div className="text-sm text-orange-400 font-mono font-semibold">{purchase.poNo}</div>;
      case 'reference':
        return <div className="text-sm text-gray-400">{purchase.reference || '-'}</div>;
      case 'supplier':
        return (
          <div className="min-w-0">
            <div className="text-sm font-medium text-white truncate leading-[1.3]">{purchase.supplier}</div>
            <div className="flex items-center gap-1 text-xs text-gray-500 leading-[1.3] mt-0.5">
              <Phone size={10} className="text-gray-600" />
              <span>{purchase.supplierContact}</span>
            </div>
          </div>
        );
      case 'location': {
        // 🔒 CLONE FROM SALE PAGE: UI Rule: Show branch NAME only (not code, never UUID)
        // purchase.location now contains branch name from context (or empty)
        // Fallback to branchMap for old data that might still have UUID
        let locationText = purchase.location || '';
        
        // If it looks like a UUID, try branchMap fallback, then show '—'
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(locationText);
        if (isUUID) {
          const resolved = branchMap.get(locationText);
          // Extract just the name if branchMap returns "BR-001 | Name" format
          if (resolved && resolved.includes('|')) {
            locationText = resolved.split('|').pop()?.trim() || '';
          } else {
            locationText = resolved || '';
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
      }
      case 'status': {
        // Enhanced Status Column: Badge + Return Icon + Attachment Icon
        const statusBadge = getPurchaseStatusBadge(purchase.status);
        const hasReturn = (purchase.status === 'final' || purchase.status === 'received') && purchasesWithReturns.has(purchase.uuid);
        // Check for attachments - handle both array and object formats
        const hasAttachments = purchase.attachments && (
          (Array.isArray(purchase.attachments) && purchase.attachments.length > 0) ||
          (typeof purchase.attachments === 'object' && Object.keys(purchase.attachments).length > 0)
        );
        
        return (
          <div className="flex items-center gap-2">
            {statusBadge}
            {hasReturn && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPurchaseReturnsDialogOpen(true);
                  if (companyId) {
                    setLoadingPurchaseReturns(true);
                    purchaseReturnService.getPurchaseReturns(companyId, branchId === 'all' ? undefined : branchId)
                      .then((list) => {
                        setPurchaseReturnsList(list);
                        setLoadingPurchaseReturns(false);
                      })
                      .catch(() => setLoadingPurchaseReturns(false));
                  }
                }}
                className="text-purple-400 hover:text-purple-300 transition-colors"
                title="View Purchase Returns"
              >
                <RotateCcw size={16} />
              </button>
            )}
            {hasAttachments && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const attachments: { url: string; name: string }[] = [];
                  
                  // Handle different attachment formats
                  if (Array.isArray(purchase.attachments)) {
                    purchase.attachments.forEach((att: any) => {
                      const url = typeof att === 'string' ? att : (att?.url || att?.fileUrl || '');
                      const name = typeof att === 'object' && att?.name ? att.name : (typeof att === 'object' && (att?.fileName || att?.file_name) ? (att.fileName || att.file_name) : 'Attachment');
                      if (url) attachments.push({ url: String(url), name: name || 'Attachment' });
                    });
                  } else if (typeof purchase.attachments === 'object' && purchase.attachments !== null) {
                    // Handle object format
                    Object.entries(purchase.attachments).forEach(([key, att]: [string, any]) => {
                      const url = typeof att === 'string' ? att : (att?.url || att?.fileUrl || key);
                      const name = typeof att === 'object' && att?.name ? att.name : (typeof att === 'object' && (att?.fileName || att?.file_name) ? (att.fileName || att.file_name) : key);
                      if (url) attachments.push({ url: String(url), name: name || 'Attachment' });
                    });
                  }
                  
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
      }
      case 'items':
        return (
          <div className="flex items-center justify-center gap-1 text-gray-300">
            <Package size={12} className="text-gray-500" />
            <span className="text-sm font-medium">{purchase.items}</span>
          </div>
        );
      case 'grandTotal':
        return (
          <div className="text-sm font-semibold text-white tabular-nums">{purchase.grandTotal.toLocaleString()}</div>
        );
      case 'paymentDue':
        return (
          <>
            {purchase.paymentDue > 0 ? (
              <button onClick={() => handleMakePayment(purchase)} className="text-sm font-semibold text-red-400 tabular-nums hover:text-red-300 hover:underline cursor-pointer transition-colors" title="Click to make payment">
                {purchase.paymentDue.toLocaleString()}
              </button>
            ) : (
              <div className="text-sm text-gray-600">-</div>
            )}
          </>
        );
      case 'paymentStatus':
        return (
          <>
            {purchase.paymentDue > 0 ? (
              <button onClick={() => handleMakePayment(purchase)} className="hover:opacity-80 transition-opacity" title="Click to make payment">
                {getPaymentStatusBadge(purchase.paymentStatus)}
              </button>
            ) : (
              getPaymentStatusBadge(purchase.paymentStatus)
            )}
          </>
        );
      case 'addedBy':
        return <div className="text-xs text-gray-400">{purchase.addedBy}</div>;
      default:
        return null;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#0B0F19]">
      {/* Page Header - Fixed */}
      <div className="shrink-0 px-6 py-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Purchases</h1>
            <p className="text-sm text-gray-400 mt-0.5">Manage purchase orders and supplier transactions</p>
          </div>
          <div className="flex gap-2">
            {activeMainTab === 'purchases' && (
              <Button 
                onClick={() => openDrawer('addPurchase')}
                className="bg-orange-600 hover:bg-orange-500 text-white h-10 gap-2"
              >
                <Plus size={16} />
                Add Purchase
              </Button>
            )}
          </div>
        </div>
        {/* Main tabs: Purchases | Returns */}
        <div className="flex items-center gap-1 mt-4 p-1 bg-gray-950 border border-gray-800 rounded-lg inline-flex">
          <button
            type="button"
            onClick={() => setActiveMainTab('purchases')}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium transition-all',
              activeMainTab === 'purchases' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
            )}
          >
            Purchases
          </button>
          <button
            type="button"
            onClick={() => setActiveMainTab('returns')}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2',
              activeMainTab === 'returns' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
            )}
          >
            <RotateCcw size={14} />
            Returns
          </button>
        </div>
      </div>

      {/* Returns tab content */}
      {activeMainTab === 'returns' && (
        <div className="flex-1 flex flex-col overflow-hidden px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Purchase Returns</h2>
            <Button
              onClick={() => setStandalonePurchaseReturnFormOpen(true)}
              className="bg-orange-600 hover:bg-orange-500 text-white h-10 gap-2"
            >
              <Plus size={16} />
              Create new return
            </Button>
          </div>
          <div className="flex-1 overflow-auto rounded-xl border border-gray-800 bg-gray-900/50">
            {loadingPurchaseReturns ? (
              <div className="py-12 text-center text-gray-400">Loading...</div>
            ) : purchaseReturnsList.length === 0 ? (
              <div className="py-12 text-center text-gray-500">No purchase returns. Click &quot;Create new return&quot; to add one.</div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-900/50 border-b border-gray-800 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase font-medium">Date</th>
                    <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase font-medium">Return #</th>
                    <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase font-medium">Supplier</th>
                    <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase font-medium">Invoice</th>
                    <th className="px-4 py-3 text-center text-xs text-gray-400 uppercase font-medium">Status</th>
                    <th className="px-4 py-3 text-right text-xs text-gray-400 uppercase font-medium">Total</th>
                    <th className="px-4 py-3 text-right text-xs text-gray-400 uppercase font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {purchaseReturnsList.map((ret: any) => (
                    <tr key={ret.id} className="hover:bg-gray-800/30">
                      <td className="px-4 py-3 text-sm text-gray-300">{formatDateAndTime(ret.return_date).date}</td>
                      <td className="px-4 py-3 text-sm font-mono text-purple-400">{ret.return_no || `PR-${ret.id?.slice(0, 8)}`}</td>
                      <td className="px-4 py-3 text-sm text-white">{ret.supplier_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-400">{ret.original_purchase_id ? ret.original_purchase_id.slice(0, 8) : '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge className={
                          String(ret?.status).toLowerCase() === 'void'
                            ? 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                            : ret.status === 'final'
                              ? 'bg-green-500/20 text-green-400 border-green-500/30'
                              : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                        }>
                          {String(ret?.status).toLowerCase() === 'void' ? 'Voided' : ret.status === 'final' ? 'Final' : 'Draft'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-red-400">{(ret.total || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreVertical size={14} /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-gray-900 border-gray-700 text-white w-56">
                            <DropdownMenuItem className="hover:bg-gray-800 cursor-pointer" onClick={() => { setSelectedPurchaseReturn(ret); setViewPurchaseReturnDetailsOpen(true); }}>
                              <Eye size={14} className="mr-2 text-blue-400" />
                              View Return Details
                            </DropdownMenuItem>
                            {ret.original_purchase_id && (
                              <DropdownMenuItem
                                className="hover:bg-gray-800 cursor-pointer"
                                onClick={() => {
                                  setOriginalPurchaseIdToView(ret.original_purchase_id);
                                  setViewDetailsOpen(true);
                                }}
                              >
                                <FileText size={14} className="mr-2 text-green-400" />
                                View Original Purchase
                              </DropdownMenuItem>
                            )}
                            {String(ret?.status).toLowerCase() !== 'final' && String(ret?.status).toLowerCase() !== 'void' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="hover:bg-gray-800 text-red-400 cursor-pointer" onClick={() => { setPurchaseReturnToDelete(ret); setDeletePurchaseReturnDialogOpen(true); }}>
                                  <Trash2 size={14} className="mr-2" /> Delete Return
                                </DropdownMenuItem>
                              </>
                            )}
                            {String(ret?.status).toLowerCase() === 'final' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="hover:bg-gray-800 text-amber-400 cursor-pointer"
                                  onClick={() => { setReturnToVoidPurchase(ret); setVoidPurchaseReturnDialogOpen(true); }}
                                >
                                  <RotateCcw size={14} className="mr-2" />
                                  Void / Cancel Return
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="hover:bg-gray-800 cursor-pointer"
                              onClick={async () => {
                                if (!companyId) return;
                                try {
                                  const fullReturn = await purchaseReturnService.getPurchaseReturnById(ret.id, companyId);
                                  setSelectedReturnForPrint(fullReturn);
                                  setPrintReturnOpen(true);
                                } catch (e: any) {
                                  toast.error(e?.message || 'Could not load return');
                                }
                              }}
                            >
                              <Printer size={14} className="mr-2 text-purple-400" />
                              Print Return
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="hover:bg-gray-800 cursor-pointer"
                              onClick={() => toast.info('Export return functionality coming soon')}
                            >
                              <Download size={14} className="mr-2 text-blue-400" />
                              Export Return
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Purchases tab: Summary Cards + Status tabs + Table */}
      {activeMainTab === 'purchases' && (
        <>
      {/* Summary Cards - Fixed */}
      <div className="shrink-0 px-6 py-4 bg-[#0F1419] border-b border-gray-800">
        <div className="grid grid-cols-4 gap-4">
          {/* Total Purchase */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Total Purchase</p>
                <p className="text-2xl font-bold text-white mt-1">{summary.totalPurchase.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">This month</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                <ShoppingBag size={24} className="text-orange-500" />
              </div>
            </div>
          </div>

          {/* Amount Due */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Amount Due</p>
                <p className="text-2xl font-bold text-red-400 mt-1">{summary.totalDue.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">Pending payments</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <DollarSign size={24} className="text-red-500" />
              </div>
            </div>
          </div>

          {/* Returns */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Returns</p>
                <p className="text-2xl font-bold text-yellow-400 mt-1">{summary.returns.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">2 items returned</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center">
                <Package size={24} className="text-yellow-500" />
              </div>
            </div>
          </div>

          {/* Purchase Orders */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Purchase Orders</p>
                <p className="text-2xl font-bold text-blue-400 mt-1">{summary.orderCount}</p>
                <p className="text-xs text-gray-500 mt-1">In list</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <FileText size={24} className="text-blue-500" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status tabs: All | Draft | Ordered | Received | Final */}
      <div className="shrink-0 px-6 pt-2 pb-1 flex items-center gap-1 border-b border-gray-800/50">
        {[
          { value: 'all' as const, label: 'All' },
          { value: 'draft' as const, label: 'Draft' },
          { value: 'ordered' as const, label: 'Ordered' },
          { value: 'received' as const, label: 'Received' },
          { value: 'final' as const, label: 'Final' },
        ].map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setStatusFilter(tab.value)}
            className={cn(
              'px-3 py-2 rounded-t-md text-sm font-medium transition-all',
              statusFilter === tab.value ? 'bg-gray-800 text-white border-t border-x border-gray-700 -mb-px' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Global List Toolbar */}
      <ListToolbar
        search={{
          value: searchTerm,
          onChange: setSearchTerm,
          placeholder: "Search by PO #, supplier, branch, reference..."
        }}
        rowsSelector={{
          value: pageSize,
          onChange: handlePageSizeChange,
          totalItems: filteredPurchases.length
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

                {/* Supplier Filter */}
                <div>
                  <label className="text-xs text-gray-400 mb-2 block font-medium">Supplier</label>
                  <div className="space-y-2">
                    {[
                      { value: 'all', label: 'All Suppliers' },
                      { value: 'Bilal Fabrics', label: 'Bilal Fabrics' },
                      { value: 'ChenOne', label: 'ChenOne' },
                      { value: 'Sapphire Mills', label: 'Sapphire Mills' },
                      { value: 'Premium Fabrics Ltd', label: 'Premium Fabrics Ltd' },
                    ].map(opt => (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="supplier"
                          checked={supplierFilter === opt.value}
                          onChange={() => setSupplierFilter(opt.value)}
                          className="w-4 h-4 bg-gray-950 border-gray-700"
                        />
                        <span className="text-sm text-gray-300">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Purchase Status Filter */}
                <div>
                  <label className="text-xs text-gray-400 mb-2 block font-medium">Purchase Status</label>
                  <div className="space-y-2">
                    {[
                      { value: 'all', label: 'All Status' },
                      { value: 'draft', label: 'Draft' },
                      { value: 'ordered', label: 'Ordered' },
                      { value: 'received', label: 'Received' },
                      { value: 'final', label: 'Final' },
                    ].map(opt => (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="status"
                          checked={statusFilter === opt.value}
                          onChange={() => setStatusFilter(opt.value as any)}
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
                      { value: 'unpaid', label: 'Unpaid / Due' },
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
              </div>
            </div>
          )
        }}
        importConfig={{
          onImport: () => console.log('Import Purchases')
        }}
        exportConfig={{
          onExportCSV: () => console.log('Export CSV'),
          onExportExcel: () => console.log('Export Excel'),
          onExportPDF: () => console.log('Export PDF')
        }}
      />

      {/* Purchases Table - Scrollable */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[1400px]">
              {/* Table Header - full-width background (w-max so it spans full table width when scrolling) */}
              <div className="sticky top-0 z-10 min-w-[1400px] w-max bg-gray-900 border-b border-gray-800">
                <div className="grid gap-3 px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider"
                  style={{ gridTemplateColumns: gridTemplateColumns }}
                >
                  {columnOrder.map(key => {
                    if (!visibleColumns[key as keyof typeof visibleColumns]) return null;
                    const isSortable = columnLabels[key] != null;
                    const isActive = sortKey === key;
                    return (
                      <div
                        key={key}
                        className={cn(
                          alignments[key] || 'text-left',
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
                        onClick={() => isSortable && handleSort(key as PurchaseSortKey)}
                      >
                        {columnLabels[key]}
                        {isSortable && isActive && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                      </div>
                    );
                  })}
                  <div className="text-center">Actions</div>
                </div>
              </div>

              {/* Table Body - w-max so row lines span full table width (no short lines on right) */}
              <div className="min-w-[1400px] w-max">
                {paginatedPurchases.length === 0 ? (
                  <div className="py-12 text-center">
                    <ShoppingBag size={48} className="mx-auto text-gray-600 mb-3" />
                    <p className="text-gray-400 text-sm">No purchases found</p>
                    <p className="text-gray-600 text-xs mt-1">Try adjusting your search or filters</p>
                  </div>
                ) : (
                  paginatedPurchases.map((purchase) => (
                    <div
                      key={purchase.id}
                      onMouseEnter={() => setHoveredRow(purchase.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                      className="grid gap-3 px-4 h-16 min-w-[1400px] w-max hover:bg-gray-800/30 transition-colors items-center border-b border-gray-800 last:border-b-0"
                      style={{ gridTemplateColumns: gridTemplateColumns }}
                    >
                      {columnOrder.map(key => {
                        if (!visibleColumns[key as keyof typeof visibleColumns]) return null;
                        // Apply same alignment classes as headers
                        const alignment = alignments[key] || 'text-left';
                        return (
                          <div 
                            key={key} 
                            className={cn(
                              alignment,
                              'flex items-center',
                              // Match header alignment with justify classes
                              alignment === 'text-right' && 'justify-end',
                              alignment === 'text-center' && 'justify-center',
                              alignment === 'text-left' && 'justify-start'
                            )}
                          >
                            {renderPurchaseCell(purchase, key)}
                          </div>
                        );
                      })}
                      {/* Actions - visible delete icon + dropdown (same as Sale) */}
                      <div className="flex items-center justify-center gap-1">
                        {canDeletePurchase && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDelete(purchase); }}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-400 hover:bg-gray-800/80 transition-all"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button 
                              className={cn(
                                "w-8 h-8 rounded-lg bg-gray-800/50 hover:bg-gray-700 transition-all flex items-center justify-center text-gray-400 hover:text-white",
                                hoveredRow === purchase.id ? "opacity-100" : "opacity-0"
                              )}
                            >
                              <MoreVertical size={16} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-gray-900 border-gray-700 text-white w-52">
                            <DropdownMenuItem 
                              onClick={() => handleViewDetails(purchase)}
                              className="hover:bg-gray-800 cursor-pointer"
                            >
                              <Eye size={14} className="mr-2 text-blue-400" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleEdit(purchase)}
                              className="hover:bg-gray-800 cursor-pointer"
                            >
                              <Edit size={14} className="mr-2 text-green-400" />
                              Edit Purchase
                            </DropdownMenuItem>
                            <DropdownMenuItem className="hover:bg-gray-800 cursor-pointer" onClick={() => handlePrintPO(purchase)}>
                              <FileText size={14} className="mr-2 text-purple-400" />
                              Print PO
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-gray-700" />
                            
                            {/* 🎯 MAKE PAYMENT - Only show if there's outstanding payment */}
                            {purchase.paymentDue > 0 && (
                              <DropdownMenuItem className="hover:bg-gray-800 cursor-pointer" onClick={() => handleMakePayment(purchase)}>
                                <DollarSign size={14} className="mr-2 text-yellow-400" />
                                Make Payment
                              </DropdownMenuItem>
                            )}
                            
                            {/* 🎯 VIEW LEDGER */}
                            <DropdownMenuItem className="hover:bg-gray-800 cursor-pointer" onClick={() => handleViewLedger(purchase)}>
                              <Receipt size={14} className="mr-2 text-blue-400" />
                              View Ledger
                            </DropdownMenuItem>
                            
                            {/* 🎯 CREATE PURCHASE RETURN - Only for final/received purchases without existing returns */}
                            {(purchase.status === 'final' || purchase.status === 'received') && 
                             !(purchase.hasReturn || purchasesWithReturns.has(purchase.uuid)) && (
                              <DropdownMenuItem 
                                className="hover:bg-gray-800 cursor-pointer" 
                                onClick={() => {
                                  setSelectedPurchaseForReturn(purchase);
                                  setPurchaseReturnFormOpen(true);
                                }}
                              >
                                <RotateCcw size={14} className="mr-2 text-purple-400" />
                                Create Purchase Return
                              </DropdownMenuItem>
                            )}
                            
                            {canDeletePurchase && (
                            <>
                            <DropdownMenuSeparator className="bg-gray-700" />
                            <DropdownMenuItem className="hover:bg-gray-800 cursor-pointer text-red-400" onClick={() => handleDelete(purchase)}>
                              <Trash2 size={14} className="mr-2" />
                              Delete
                            </DropdownMenuItem>
                            </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
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
        totalItems={filteredPurchases.length}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
        </>
      )}

      {/* STEP 2 FIX: View Payments Modal (like Sale module) */}
      {selectedPurchase && (
        <ViewPaymentsModal
          isOpen={viewPaymentsOpen}
          onClose={() => {
            setViewPaymentsOpen(false);
            setSelectedPurchase(null);
          }}
          invoice={{
            id: selectedPurchase.uuid,
            invoiceNo: selectedPurchase.poNo,
            date: selectedPurchase.date,
            customerName: selectedPurchase.supplier,
            customerId: selectedPurchase.uuid,
            total: selectedPurchase.grandTotal,
            paid: selectedPurchase.grandTotal - selectedPurchase.paymentDue,
            due: selectedPurchase.paymentDue,
            paymentStatus: selectedPurchase.paymentStatus,
            referenceType: 'purchase', // 🔒 UUID ARCHITECTURE: Explicit entity type (no pattern matching)
          }}
          onAddPayment={handleAddPaymentFromModal}
          onDeletePayment={async (paymentId: string) => {
            if (!selectedPurchase?.uuid || !paymentId) {
              throw new Error('Purchase or Payment ID not found');
            }
            try {
              await purchaseService.deletePayment(paymentId, selectedPurchase.uuid);
              await loadPurchases();
              window.dispatchEvent(new CustomEvent('paymentAdded'));
            } catch (error: any) {
              console.error('[PURCHASES PAGE] Error deleting payment:', error);
              throw new Error(error?.message || 'Failed to delete payment. Please try again.');
            }
          }}
          onRefresh={async () => {
            await loadPurchases();
          }}
        />
      )}

      {/* Unified Payment Dialog */}
      {selectedPurchase && (
        <UnifiedPaymentDialog
          isOpen={isPaymentDialogOpen}
          onClose={() => {
            setIsPaymentDialogOpen(false);
            // Re-open View Payments modal after payment is cancelled (like Sale module)
            if (!viewPaymentsOpen) {
              setViewPaymentsOpen(true);
            }
          }}
          context="supplier"
          entityName={selectedPurchase.supplier}
          entityId={selectedPurchase.uuid}
          outstandingAmount={selectedPurchase.paymentDue}
          totalAmount={selectedPurchase.grandTotal}
          paidAmount={selectedPurchase.grandTotal - selectedPurchase.paymentDue}
          referenceNo={selectedPurchase.poNo}
          referenceId={selectedPurchase.uuid}
          onSuccess={async () => {
            toast.success('Payment recorded successfully');
            
            // CRITICAL FIX: Reload specific purchase from database to get updated paid_amount/due_amount
            if (selectedPurchase?.uuid) {
              try {
                const purchaseData = await purchaseService.getPurchase(selectedPurchase.uuid);
                if (purchaseData) {
                  // Get branch name from branchMap or purchaseData
                  let location = selectedPurchase.location;
                  if (purchaseData.branch?.name) {
                    location = purchaseData.branch.name;
                  } else if (purchaseData.branch_id && branchMap.size > 0) {
                    location = branchMap.get(purchaseData.branch_id) || selectedPurchase.location;
                  }
                  
                  const convertedPurchase: Purchase = {
                    id: selectedPurchase.id, // Keep same ID
                    uuid: purchaseData.id,
                    poNo: purchaseData.po_no || selectedPurchase.poNo,
                    date: purchaseData.po_date || selectedPurchase.date,
                    supplier: purchaseData.supplier?.name || purchaseData.supplier_name || selectedPurchase.supplier,
                    supplierContact: purchaseData.supplier?.phone || selectedPurchase.supplierContact,
                    reference: purchaseData.reference || purchaseData.notes || selectedPurchase.reference,
                    location: location,
                    items: purchaseData.items?.length || selectedPurchase.items,
                    grandTotal: purchaseData.total || selectedPurchase.grandTotal,
                    paymentDue: purchaseData.due_amount || 0, // CRITICAL: Get updated due_amount from database (trigger updated it)
                    status: (purchaseData.status === 'final' ? 'final' : 
                             purchaseData.status === 'received' ? 'received' : 
                             purchaseData.status === 'ordered' ? 'ordered' : 
                             purchaseData.status === 'draft' ? 'draft' : 
                             'draft') as PurchaseStatus,
                    paymentStatus: purchaseData.payment_status || 'unpaid',
                    addedBy: purchaseData.created_by_user?.full_name || purchaseData.created_by_user?.email || selectedPurchase.addedBy || 'System',
                  };
                  setSelectedPurchase(convertedPurchase);
                }
              } catch (error: any) {
                console.error('[PURCHASES PAGE] Error reloading purchase after payment:', error);
              }
            }
            
            // Reload all purchases list
            await loadPurchases();
            setIsPaymentDialogOpen(false);
            
            // Re-open View Payments modal to show updated data
            setViewPaymentsOpen(true);
          }}
        />
      )}

      {/* View Purchase Details Drawer (from list or from "View Original Purchase" on return) */}
      {(selectedPurchase || originalPurchaseIdToView) && (
        <ViewPurchaseDetailsDrawer
          isOpen={viewDetailsOpen || !!originalPurchaseIdToView}
          onClose={() => {
            setViewDetailsOpen(false);
            setSelectedPurchase(null);
            setOriginalPurchaseIdToView(null);
          }}
          purchaseId={selectedPurchase?.uuid ?? originalPurchaseIdToView ?? ''}
          onEdit={() => {
            setViewDetailsOpen(false);
            if (selectedPurchase) handlePurchaseAction('edit', selectedPurchase);
            setOriginalPurchaseIdToView(null);
          }}
          onDelete={() => {
            setViewDetailsOpen(false);
            if (selectedPurchase) handlePurchaseAction('delete', selectedPurchase);
            setOriginalPurchaseIdToView(null);
          }}
          onAddPayment={() => {
            setViewDetailsOpen(false);
            if (selectedPurchase) handlePurchaseAction('make_payment', selectedPurchase);
            setOriginalPurchaseIdToView(null);
          }}
          onOpenReturn={() => {
            if (selectedPurchase) setSelectedPurchaseForReturn(selectedPurchase);
            setPurchaseReturnFormOpen(true);
            setViewDetailsOpen(false);
            setOriginalPurchaseIdToView(null);
          }}
          canDelete={canDeletePurchase}
        />
      )}

      {/* Unified Ledger View */}
      {selectedPurchase && (
        <UnifiedLedgerView
          isOpen={isLedgerOpen}
          onClose={() => {
            setIsLedgerOpen(false);
            setSelectedPurchase(null);
          }}
          entityType="supplier"
          entityName={selectedPurchase.supplier}
          entityId={selectedPurchase.uuid}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {selectedPurchase && (
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="bg-gray-900 border-gray-700 text-white max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-red-400 flex items-center gap-2">
                <AlertCircle size={20} />
                Delete Purchase Order
              </AlertDialogTitle>
              <AlertDialogDescription className="text-gray-300 space-y-3 mt-4">
                <p>
                  Are you sure you want to permanently delete <strong className="text-white">{selectedPurchase.poNo}</strong>?
                </p>
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 space-y-2">
                  <p className="text-sm font-semibold text-red-400">⚠️ This will permanently delete:</p>
                  <ul className="text-xs text-gray-300 space-y-1 list-disc list-inside ml-2">
                    <li>Purchase record and all items</li>
                    <li>All payments (cash/bank) and accounting entries</li>
                    <li>Stock movements (stock will be reversed)</li>
                    <li>Supplier ledger entries</li>
                    <li>All related activity logs</li>
                  </ul>
                </div>
                <p className="text-sm text-red-400 font-semibold">
                  This action cannot be undone.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Yes, Delete Purchase
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* 🎯 ATTACHMENTS VIEWER - Shared Component */}
      {attachmentsDialogList && (
        <AttachmentViewer
          attachments={attachmentsDialogList}
          isOpen={!!attachmentsDialogList}
          onClose={() => setAttachmentsDialogList(null)}
        />
      )}

      {/* Purchase Returns List Dialog */}
      <Dialog open={purchaseReturnsDialogOpen} onOpenChange={setPurchaseReturnsDialogOpen}>
        <DialogContent className="bg-[#0B0F19] border-gray-800 text-white max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <RotateCcw size={20} className="text-purple-400" />
              Purchase Returns
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 min-h-0">
            {loadingPurchaseReturns ? (
              <div className="py-12 text-center text-gray-400">Loading...</div>
            ) : purchaseReturnsList.length === 0 ? (
              <div className="py-12 text-center text-gray-500">No purchase returns found.</div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-900/50 border-b border-gray-800">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs text-gray-400 uppercase">Date</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-400 uppercase">Return #</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-400 uppercase">Supplier</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-400 uppercase">Original PO</th>
                    <th className="px-4 py-2 text-center text-xs text-gray-400 uppercase">Status</th>
                    <th className="px-4 py-2 text-right text-xs text-gray-400 uppercase">Total</th>
                    <th className="px-4 py-2 text-right text-xs text-gray-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {purchaseReturnsList.map((ret: any) => (
                    <tr key={ret.id} className="hover:bg-gray-800/30">
                      <td className="px-4 py-2 text-sm text-gray-300">{formatDateAndTime(ret.return_date).date}</td>
                      <td className="px-4 py-2 text-sm font-mono text-purple-400">{ret.return_no || `PRET-${ret.id?.slice(0, 8)}`}</td>
                      <td className="px-4 py-2 text-sm text-white">{ret.supplier_name}</td>
                      <td className="px-4 py-2 text-sm text-gray-400">{ret.original_purchase_id?.slice(0, 8)}</td>
                      <td className="px-4 py-2 text-center">
                        <Badge className={
                          String(ret?.status).toLowerCase() === 'void'
                            ? 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                            : ret.status === 'final'
                              ? 'bg-green-500/20 text-green-400 border-green-500/30'
                              : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                        }>
                          {String(ret?.status).toLowerCase() === 'void' ? 'Voided' : ret.status === 'final' ? 'FINAL / LOCKED' : 'Draft'}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-right text-sm font-semibold text-red-400">{(ret.total || 0).toLocaleString()}</td>
                      <td className="px-4 py-2 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreVertical size={14} /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-gray-900 border-gray-700 text-white w-56">
                            <DropdownMenuItem className="hover:bg-gray-800 cursor-pointer" onClick={() => { setPurchaseReturnsDialogOpen(false); setSelectedPurchaseReturn(ret); setViewPurchaseReturnDetailsOpen(true); }}>
                              <Eye size={14} className="mr-2 text-blue-400" />
                              View Return Details
                            </DropdownMenuItem>
                            {ret.original_purchase_id && (
                              <DropdownMenuItem
                                className="hover:bg-gray-800 cursor-pointer"
                                onClick={() => {
                                  setPurchaseReturnsDialogOpen(false);
                                  setOriginalPurchaseIdToView(ret.original_purchase_id);
                                  setViewDetailsOpen(true);
                                }}
                              >
                                <FileText size={14} className="mr-2 text-green-400" />
                                View Original Purchase
                              </DropdownMenuItem>
                            )}
                            {String(ret?.status).toLowerCase() !== 'final' && String(ret?.status).toLowerCase() !== 'void' && (
                              <DropdownMenuItem className="hover:bg-gray-800 text-red-400 cursor-pointer" onClick={() => { setPurchaseReturnToDelete(ret); setDeletePurchaseReturnDialogOpen(true); }}>
                                <Trash2 size={14} className="mr-2" /> Delete Return
                              </DropdownMenuItem>
                            )}
                            {String(ret?.status).toLowerCase() === 'final' && (
                              <DropdownMenuItem className="hover:bg-gray-800 text-amber-400 cursor-pointer" onClick={() => { setReturnToVoidPurchase(ret); setVoidPurchaseReturnDialogOpen(true); }}>
                                <RotateCcw size={14} className="mr-2" /> Void / Cancel Return
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator className="bg-gray-700" />
                            <DropdownMenuItem
                              className="hover:bg-gray-800 cursor-pointer"
                              onClick={async () => {
                                if (!companyId) return;
                                try {
                                  const fullReturn = await purchaseReturnService.getPurchaseReturnById(ret.id, companyId);
                                  setSelectedReturnForPrint(fullReturn);
                                  setPrintReturnOpen(true);
                                } catch (e: any) {
                                  toast.error(e?.message || 'Could not load return');
                                }
                              }}
                            >
                              <Printer size={14} className="mr-2 text-purple-400" />
                              Print Return
                            </DropdownMenuItem>
                            <DropdownMenuItem className="hover:bg-gray-800 cursor-pointer" onClick={() => toast.info('Export return functionality coming soon')}>
                              <Download size={14} className="mr-2 text-blue-400" />
                              Export Return
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* View Purchase Return Details — same layout as Sale Return View */}
      {selectedPurchaseReturn && (
        <Dialog open={viewPurchaseReturnDetailsOpen} onOpenChange={setViewPurchaseReturnDetailsOpen}>
          <DialogContent className="bg-[#0B0F19] border-gray-800 text-white !w-[800px] !max-w-[800px] sm:!max-w-[800px] max-h-[90vh] overflow-y-auto">
            <DialogHeader className="border-b border-gray-800 pb-4">
              <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <RotateCcw size={20} className="text-purple-400" />
                </div>
                <div>
                  <div>Return Details</div>
                  <div className="text-sm font-mono text-purple-400 font-normal">{selectedPurchaseReturn.return_no || `PR-${selectedPurchaseReturn.id?.slice(0, 8).toUpperCase()}`}</div>
                </div>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6 mt-4">
              {/* Return Header Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-[#0F1419] rounded-lg border border-gray-800">
                <div>
                  <p className="text-xs text-gray-400 uppercase mb-1">Return Date</p>
                  <p className="text-sm text-white font-medium">{formatDateAndTime(selectedPurchaseReturn.return_date || selectedPurchaseReturn.created_at).date} {formatDateAndTime(selectedPurchaseReturn.return_date || selectedPurchaseReturn.created_at).time}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase mb-1">Status</p>
                  <Badge className={
                    String(selectedPurchaseReturn.status).toLowerCase() === 'void' ? 'bg-gray-500/20 text-gray-400 border-gray-500/30' :
                    selectedPurchaseReturn.status === 'final' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                  }>
                    {String(selectedPurchaseReturn.status).toLowerCase() === 'void' ? 'Voided' : selectedPurchaseReturn.status === 'final' ? 'FINAL / LOCKED' : 'Draft'}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase mb-1">Supplier</p>
                  <p className="text-sm text-white font-medium">{selectedPurchaseReturn.supplier_name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase mb-1">Location</p>
                  <p className="text-sm text-white">{branchMap.get(selectedPurchaseReturn.branch_id) || '—'}</p>
                </div>
                {selectedPurchaseReturn.original_purchase_id && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase mb-1">Original Purchase</p>
                    <button
                      type="button"
                      onClick={() => {
                        setViewPurchaseReturnDetailsOpen(false);
                        setOriginalPurchaseIdToView(selectedPurchaseReturn.original_purchase_id);
                        setViewDetailsOpen(true);
                      }}
                      className="text-sm text-blue-400 hover:text-blue-300 hover:underline font-mono"
                    >
                      {purchases.find(p => p.uuid === selectedPurchaseReturn.original_purchase_id)?.poNo || `PO: ${selectedPurchaseReturn.original_purchase_id?.slice(0, 8)}`}
                    </button>
                  </div>
                )}
                {selectedPurchaseReturn.reason && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-400 uppercase mb-1">Reason</p>
                    <p className="text-sm text-white">{selectedPurchaseReturn.reason}</p>
                  </div>
                )}
                {selectedPurchaseReturn.notes && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-400 uppercase mb-1">Notes</p>
                    <p className="text-sm text-gray-300">{selectedPurchaseReturn.notes}</p>
                  </div>
                )}
              </div>

              {/* Return Items */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Return Items</h3>
                {selectedPurchaseReturn.items && selectedPurchaseReturn.items.length > 0 ? (
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
                        {selectedPurchaseReturn.items.map((item: any, idx: number) => (
                          <tr key={idx} className="hover:bg-[#0B0F19] transition-colors">
                            <td className="px-4 py-3 text-sm text-white">{item.product_name}</td>
                            <td className="px-4 py-3 text-sm text-gray-400 font-mono">{item.sku}</td>
                            <td className="px-4 py-3 text-sm text-gray-300 text-center">{item.quantity}</td>
                            <td className="px-4 py-3 text-sm text-gray-300 text-right tabular-nums">PKR {item.unit_price?.toLocaleString() || '0'}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-red-400 text-right tabular-nums">-PKR {item.total?.toLocaleString() || '0'}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-[#0B0F19] border-t border-gray-800">
                        <tr>
                          <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-gray-300 text-right">Total Return Amount:</td>
                          <td className="px-4 py-3 text-lg font-bold text-red-400 text-right tabular-nums">-PKR {selectedPurchaseReturn.total?.toLocaleString() || '0'}</td>
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
                onClick={() => setViewPurchaseReturnDetailsOpen(false)}
                className="border-gray-800 text-gray-300 hover:text-white hover:bg-gray-800"
              >
                Close
              </Button>
              <Button
                onClick={async () => {
                  if (!selectedPurchaseReturn?.id || !companyId) return;
                  try {
                    const fullReturn = await purchaseReturnService.getPurchaseReturnById(selectedPurchaseReturn.id, companyId);
                    setSelectedReturnForPrint(fullReturn);
                    setPrintReturnOpen(true);
                  } catch (error: any) {
                    console.error('[PurchasesPage] Error loading return for print:', error);
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

      {/* Standalone Purchase Return (no invoice) */}
      {standalonePurchaseReturnFormOpen && (
        <StandalonePurchaseReturnForm
          open={standalonePurchaseReturnFormOpen}
          onClose={() => setStandalonePurchaseReturnFormOpen(false)}
          onSuccess={async () => {
            if (companyId) {
              try {
                const list = await purchaseReturnService.getPurchaseReturns(companyId, branchId === 'all' ? undefined : branchId);
                setPurchaseReturnsList(list);
                const returnPurchaseIds = new Set(list.map((r: any) => r.original_purchase_id).filter(Boolean));
                setPurchasesWithReturns(returnPurchaseIds);
              } catch (error) {
                console.error('[PURCHASES PAGE] Error reloading purchase returns:', error);
              }
            }
          }}
        />
      )}

      {/* Purchase Return Form (from invoice) */}
      {selectedPurchaseForReturn && purchaseReturnFormOpen && (
        <PurchaseReturnForm
          purchaseId={selectedPurchaseForReturn.uuid}
          onClose={() => {
            setPurchaseReturnFormOpen(false);
            setSelectedPurchaseForReturn(null);
            loadPurchases();
            // Reload purchase returns list
            if (companyId) {
              purchaseReturnService.getPurchaseReturns(companyId, branchId === 'all' ? undefined : branchId)
                .then((list) => {
                  setPurchaseReturnsList(list);
                  // Update purchasesWithReturns set
                  const returnPurchaseIds = new Set(list.map((r: any) => r.original_purchase_id));
                  setPurchasesWithReturns(returnPurchaseIds);
                })
                .catch(() => {});
            }
          }}
          onSuccess={() => {
            loadPurchases();
            if (companyId) {
              purchaseReturnService.getPurchaseReturns(companyId, branchId === 'all' ? undefined : branchId)
                .then((list) => {
                  setPurchaseReturnsList(list);
                  const returnPurchaseIds = new Set(list.map((r: any) => r.original_purchase_id));
                  setPurchasesWithReturns(returnPurchaseIds);
                })
                .catch(() => {});
            }
          }}
        />
      )}

      {/* Delete Purchase Return (draft only) */}
      <AlertDialog open={deletePurchaseReturnDialogOpen} onOpenChange={setDeletePurchaseReturnDialogOpen}>
        <AlertDialogContent className="bg-gray-900 border-gray-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Purchase Return?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300">
              Only draft returns can be deleted. Delete return {purchaseReturnToDelete?.return_no || purchaseReturnToDelete?.id?.slice(0, 8)}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-700">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={async () => {
                if (!purchaseReturnToDelete || !companyId) return;
                try {
                  await purchaseReturnService.deletePurchaseReturn(purchaseReturnToDelete.id, companyId);
                  toast.success('Return deleted');
                  setDeletePurchaseReturnDialogOpen(false);
                  setPurchaseReturnToDelete(null);
                  const list = await purchaseReturnService.getPurchaseReturns(companyId, branchId === 'all' ? undefined : branchId);
                  setPurchaseReturnsList(list);
                } catch (e: any) {
                  toast.error(e.message || 'Delete failed');
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Void Purchase Return (final only) — same as Sale Return */}
      <AlertDialog open={voidPurchaseReturnDialogOpen} onOpenChange={(open) => { setVoidPurchaseReturnDialogOpen(open); if (!open) setReturnToVoidPurchase(null); }}>
        <AlertDialogContent className="bg-gray-900 border-gray-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Void / Cancel Return?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300">
              This will <span className="font-semibold text-amber-400">void</span> return <span className="font-semibold text-white">{returnToVoidPurchase?.return_no || `PR-${returnToVoidPurchase?.id?.slice(0, 8)}`}</span>.
              Stock will be reversed (returned items will be added back to inventory). Supplier payable will be increased again. The return will be marked as void and kept for audit. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-700 text-gray-300 hover:bg-gray-800" disabled={voidingPurchaseReturn}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700"
              disabled={voidingPurchaseReturn}
              onClick={async () => {
                if (!returnToVoidPurchase || !companyId) return;
                setVoidingPurchaseReturn(true);
                try {
                  await purchaseReturnService.voidPurchaseReturn(returnToVoidPurchase.id, companyId, branchId === 'all' ? undefined : branchId, undefined);
                  toast.success('Return voided successfully. Stock reversed.');
                  setVoidPurchaseReturnDialogOpen(false);
                  setReturnToVoidPurchase(null);
                  const list = await purchaseReturnService.getPurchaseReturns(companyId, branchId === 'all' ? undefined : branchId);
                  setPurchaseReturnsList(list);
                } catch (e: any) {
                  toast.error(e?.message || 'Failed to void return');
                } finally {
                  setVoidingPurchaseReturn(false);
                }
              }}
            >
              {voidingPurchaseReturn ? 'Voiding…' : 'Void Return'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Purchase Return Print Dialog */}
      {selectedReturnForPrint && printReturnOpen && (
        <PurchaseReturnPrintLayout
          purchaseReturn={selectedReturnForPrint}
          onClose={() => {
            setPrintReturnOpen(false);
            setSelectedReturnForPrint(null);
          }}
        />
      )}
    </div>
  );
};