import React, { useState, useEffect, useCallback } from 'react';
import { usePurchases, Purchase, convertFromSupabasePurchase } from '@/app/context/PurchaseContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useSettings } from '@/app/context/SettingsContext';
import { branchService, Branch } from '@/app/services/branchService';
import { contactService } from '@/app/services/contactService';
import { purchaseService } from '@/app/services/purchaseService';
import { activityLogService } from '@/app/services/activityLogService';
import { PurchaseOrderPrintLayout } from '../shared/PurchaseOrderPrintLayout';
import { PaymentDeleteConfirmationModal } from '../shared/PaymentDeleteConfirmationModal';
import { UnifiedPaymentDialog } from '../shared/UnifiedPaymentDialog';
import { ViewPaymentsModal, type InvoiceDetails, type Payment } from '@/app/components/sales/ViewPaymentsModal';
import { 
  X, 
  Calendar, 
  User, 
  Phone, 
  MapPin, 
  Package, 
  DollarSign, 
  CreditCard, 
  Truck,
  Edit,
  Trash2,
  FileText,
  CheckCircle2,
  Clock,
  Building2,
  UserCheck,
  Printer,
  Download,
  Share2,
  MoreVertical,
  ShoppingBag,
  Paperclip,
  Image as ImageIcon,
  File,
  RotateCcw,
  Minus,
  Plus,
  Save,
  Loader2,
  Check
} from 'lucide-react';
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { CalendarDatePicker } from "../ui/CalendarDatePicker";
import { cn, formatBoxesPieces } from "../ui/utils";
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { useFormatDate } from '@/app/hooks/useFormatDate';
import { toast } from 'sonner';
import { purchaseReturnService } from '@/app/services/purchaseReturnService';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { getAttachmentOpenUrl } from '@/app/utils/paymentAttachmentUrl';
import { getEffectivePurchaseStatus, getPurchaseStatusBadgeConfig, canAddPaymentToPurchase } from '@/app/utils/statusHelpers';
import { AttachmentViewer } from '@/app/components/shared/AttachmentViewer';
import { PackingEntryModal } from '@/app/components/transactions/PackingEntryModal';
import { PurchaseReturnItemSelectionDialog } from '@/app/components/purchases/PurchaseReturnItemSelectionDialog';

function AttachmentImage({ att }: { att: { url: string; name: string } }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    getAttachmentOpenUrl(att.url).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => { cancelled = true; };
  }, [att.url]);
  if (!src) return <div className="h-32 flex items-center justify-center text-gray-500 text-sm">Loading...</div>;
  return (
    <img
      src={src}
      alt={att.name || 'Attachment'}
      className="w-full max-w-md max-h-48 object-contain rounded border border-gray-700 bg-gray-900"
    />
  );
}

interface PurchaseItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  price: number;
  quantity: number;
  receivedQty?: number;
  unit?: string;
  packingDetails?: { total_boxes?: number; total_pieces?: number; total_meters?: number; [k: string]: unknown };
}

interface Payment {
  id: string;
  date: string;
  amount: number;
  method: string;
  referenceNo?: string;
  accountName?: string;
  notes?: string;
}

interface ViewPurchaseDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  purchaseId: string | null;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onAddPayment?: (id: string) => void;
  onPrint?: (id: string) => void;
  /** When provided, "Return Items" opens the Purchase Return dialog (same layout as Sales Return) instead of inline return mode */
  onOpenReturn?: () => void;
  /** Permission: show delete option. Default true for backward compat. */
  canDelete?: boolean;
}

export const ViewPurchaseDetailsDrawer: React.FC<ViewPurchaseDetailsDrawerProps> = ({
  isOpen,
  onClose,
  purchaseId,
  onEdit,
  onDelete,
  onAddPayment,
  onPrint,
  onOpenReturn,
  canDelete = true,
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'payments' | 'history'>('details');
  const { formatCurrency } = useFormatCurrency();
  const { formatDate, formatDateTime } = useFormatDate();
  const { getPurchaseById } = usePurchases();
  const { companyId, branchId: contextBranchId, user } = useSupabase();
  const { inventorySettings } = useSettings();
  const enablePacking = inventorySettings.enablePacking;
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPrintLayout, setShowPrintLayout] = useState(false);
  const [branchMap, setBranchMap] = useState<Map<string, string>>(new Map());
  const [supplierCode, setSupplierCode] = useState<string | null>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [loadingActivityLogs, setLoadingActivityLogs] = useState(false);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<any | null>(null);
  const [isDeletingPayment, setIsDeletingPayment] = useState(false);
  const [editPaymentDialogOpen, setEditPaymentDialogOpen] = useState(false);
  const [paymentToEdit, setPaymentToEdit] = useState<any | null>(null);
  const [viewPaymentsModalOpen, setViewPaymentsModalOpen] = useState(false);
  const [attachmentsDialogList, setAttachmentsDialogList] = useState<{ url: string; name: string }[] | null>(null);
  
  // Return Mode state
  const [returnMode, setReturnMode] = useState(false);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [alreadyReturnedMap, setAlreadyReturnedMap] = useState<Record<string, number>>({});
  const [savingReturn, setSavingReturn] = useState(false);
  const [returnDate, setReturnDate] = useState<Date>(new Date());
  const [returnReason, setReturnReason] = useState('');
  const [returnNotes, setReturnNotes] = useState('');
  
  // Packing Modal state
  const [packingModalOpen, setPackingModalOpen] = useState(false);
  const [activePackingItem, setActivePackingItem] = useState<any>(null);
  const [returnPackingDetails, setReturnPackingDetails] = useState<Record<string, any>>({}); // Store return packing per item
  const [alreadyReturnedPiecesMap, setAlreadyReturnedPiecesMap] = useState<Record<string, Set<string>>>({}); // Track already returned pieces per item
  const [itemSelectionDialogOpen, setItemSelectionDialogOpen] = useState(false);
  const [purchaseReturns, setPurchaseReturns] = useState<any[]>([]);
  const [loadingPurchaseReturns, setLoadingPurchaseReturns] = useState(false);

  // Load branches for location display
  useEffect(() => {
    const loadBranches = async () => {
      if (!companyId) return;
      try {
        const branchesData = await branchService.getAllBranches(companyId);
        // Create mapping from branch_id to branch name
        const map = new Map<string, string>();
        branchesData.forEach(branch => {
          map.set(branch.id, branch.name);
        });
        setBranchMap(map);
      } catch (error) {
        console.error('[VIEW PURCHASE DETAILS] Error loading branches:', error);
      }
    };
    loadBranches();
  }, [companyId]);

  // CRITICAL FIX: Load payments breakdown (defined first to avoid hoisting issue)
  const loadPayments = useCallback(async (purchaseId: string) => {
    if (!purchaseId) {
      console.warn('[VIEW PURCHASE] loadPayments called without purchaseId');
      return;
    }
    setLoadingPayments(true);
    try {
      const fetchedPayments = await purchaseService.getPurchasePayments(purchaseId);
      setPayments(fetchedPayments || []);
    } catch (error) {
      console.error('[VIEW PURCHASE] Error loading payments:', error);
      setPayments([]);
    } finally {
      setLoadingPayments(false);
    }
  }, []);

  // CRITICAL FIX: Load activity logs (defined before useEffect that uses it)
  const loadActivityLogs = useCallback(async (purchaseId: string) => {
    if (!companyId || !purchaseId) return;
    setLoadingActivityLogs(true);
    try {
      const logs = await activityLogService.getEntityActivityLogs(companyId, 'purchase', purchaseId);
      setActivityLogs(logs);
    } catch (error) {
      console.error('[VIEW PURCHASE] Error loading activity logs:', error);
      setActivityLogs([]);
    } finally {
      setLoadingActivityLogs(false);
    }
  }, [companyId]);

  // Load purchase data from context (TASK 2 & 3 FIX - Real data instead of mock)
  useEffect(() => {
    if (isOpen && purchaseId) {
      const loadPurchaseData = async () => {
        setLoading(true);
        try {
          // CRITICAL FIX: Fetch fresh purchase data from database (not just context)
          const purchaseData = await purchaseService.getPurchase(purchaseId);
          if (purchaseData) {
            const convertedPurchase = convertFromSupabasePurchase(purchaseData);
            // Preserve variation data from raw purchase data for display
            if (purchaseData.items && convertedPurchase.items) {
              convertedPurchase.items = convertedPurchase.items.map((item, idx) => {
                const rawItem = purchaseData.items[idx];
                if (rawItem) {
                  return {
                    ...item,
                    // Preserve variation object for display
                    variation: rawItem.variation || rawItem.product_variations || null,
                  } as any;
                }
                return item;
              });
            }
            // CRITICAL FIX: Ensure attachments are preserved
            if (purchaseData.attachments) {
              convertedPurchase.attachments = purchaseData.attachments;
            }
            setPurchase(convertedPurchase);
            
            // CRITICAL FIX: Load supplier code if supplier ID exists
            if (convertedPurchase.supplier && companyId) {
              contactService.getContact(convertedPurchase.supplier)
                .then(contact => {
                  if (contact && (contact as any).code) {
                    setSupplierCode((contact as any).code);
                  } else {
                    setSupplierCode(null);
                  }
                })
                .catch(error => {
                  console.error('[VIEW PURCHASE] Error loading supplier:', error);
                  setSupplierCode(null);
                });
            } else {
              setSupplierCode(null);
            }
            
            // CRITICAL FIX: Load payments breakdown and activity timeline
            await loadPayments(purchaseData.id);
            loadActivityLogs(purchaseData.id);
          } else {
            // Fallback to context
            console.log('[VIEW PURCHASE] Purchase not found in database, trying context...');
            const contextPurchase = getPurchaseById(purchaseId);
            if (contextPurchase) {
              console.log('[VIEW PURCHASE] Found purchase in context, ID:', contextPurchase.id);
              setPurchase(contextPurchase);
              await loadPayments(contextPurchase.id);
              loadActivityLogs(contextPurchase.id);
            } else {
              console.error('[VIEW PURCHASE] Purchase not found in context either, purchaseId:', purchaseId);
            }
          }
        } catch (error: any) {
          console.error('[VIEW PURCHASE] Error loading purchase:', error?.message || error);
          // Fallback to context
          const contextPurchase = getPurchaseById(purchaseId);
          if (contextPurchase) {
            console.log('[VIEW PURCHASE] Fallback: Using context purchase, ID:', contextPurchase.id);
            setPurchase(contextPurchase);
            await loadPayments(contextPurchase.id);
            loadActivityLogs(contextPurchase.id);
          } else {
            // If context also doesn't have it, show error
            console.error('[VIEW PURCHASE] Purchase not found in context either');
          }
        } finally {
          setLoading(false);
        }
      };

      loadPurchaseData();
    } else {
      setLoading(false);
      // Clear payments when drawer closes
      setPayments([]);
    }
  }, [isOpen, purchaseId, getPurchaseById, companyId, loadPayments, loadActivityLogs]);

  // Load already returned quantities and pieces when purchase is loaded
  useEffect(() => {
    const loadAlreadyReturned = async () => {
      if (!purchase?.id || !companyId) return;
      try {
        const items = await purchaseReturnService.getOriginalPurchaseItems(purchase.id, companyId);
        const returnedMap: Record<string, number> = {};
        const returnedPiecesMap: Record<string, Set<string>> = {};
        
        items.forEach((item) => {
          const key = `${item.product_id}_${item.variation_id || 'null'}`;
          returnedMap[key] = item.already_returned || 0;
          
          // Store returned pieces per item
          const itemReturnedPieces = (item as any).already_returned_pieces;
          if (itemReturnedPieces && itemReturnedPieces instanceof Set) {
            returnedPiecesMap[key] = itemReturnedPieces;
          } else {
            returnedPiecesMap[key] = new Set();
          }
        });
        
        setAlreadyReturnedMap(returnedMap);
        setAlreadyReturnedPiecesMap(returnedPiecesMap);
      } catch (error) {
        console.error('[VIEW PURCHASE] Error loading already returned quantities:', error);
      }
    };
    if (purchase) {
      loadAlreadyReturned();
    }
  }, [purchase, companyId]);

  // Return Mode handlers
  const handleEnterReturnMode = () => {
    if (!purchase || (purchase.status !== 'final' && purchase.status !== 'received')) {
      toast.error('Purchase return allowed only for final/received purchases.');
      return;
    }
    setReturnMode(true);
    // Initialize return quantities to 0 for all items
    const initialQuantities: Record<string, number> = {};
    purchase.items.forEach((item) => {
      const key = `${item.productId}_${item.variationId || 'null'}`;
      initialQuantities[key] = 0;
    });
    setReturnQuantities(initialQuantities);
    // Clear any previous return packing details
    setReturnPackingDetails({});
  };

  const handleExitReturnMode = () => {
    setReturnMode(false);
    setReturnQuantities({});
    setReturnReason('');
    setReturnNotes('');
  };
  
  const handleOpenPackingModal = (item: any) => {
    setActivePackingItem(item);
    setPackingModalOpen(true);
  };
  
  const handleSaveReturnPacking = (itemKey: string, returnPacking: any) => {
    setReturnPackingDetails(prev => ({
      ...prev,
      [itemKey]: returnPacking
    }));
    // Auto-bind: Return Qty = returned_total_meters from dialog (single source of truth)
    const meters = Number(returnPacking?.returned_total_meters ?? 0);
    setReturnQuantities(prev => ({ ...prev, [itemKey]: meters }));
    setPackingModalOpen(false);
    setActivePackingItem(null);
  };

  const handleReturnQuantityChange = (itemKey: string, value: number) => {
    const item = purchase?.items.find((it) => {
      const key = `${it.productId}_${it.variationId || 'null'}`;
      return key === itemKey;
    });
    if (!item) {
      console.warn('[VIEW PURCHASE] Item not found for key:', itemKey);
      return;
    }

    const originalQty = item.quantity ?? 0;
    const alreadyReturned = alreadyReturnedMap[itemKey] || 0;
    const maxReturnable = originalQty - alreadyReturned;
    const qty = Math.max(0, Math.min(maxReturnable, isNaN(value) ? 0 : value));

    console.log('[VIEW PURCHASE] handleReturnQuantityChange:', {
      itemKey,
      inputValue: value,
      calculatedQty: qty,
      maxReturnable,
      originalQty,
      alreadyReturned,
      currentState: returnQuantities[itemKey]
    });

    setReturnQuantities(prev => {
      const updated = {
        ...prev,
        [itemKey]: qty
      };
      console.log('[VIEW PURCHASE] State before update:', prev);
      console.log('[VIEW PURCHASE] State after update:', updated);
      return updated;
    });
  };

  const handleSaveReturn = async () => {
    if (!purchase || !companyId || !contextBranchId || !user) {
      toast.error('Missing required information');
      return;
    }

    const branchId = contextBranchId === 'all' ? undefined : contextBranchId;
    if (!branchId) {
      toast.error('Please select a branch');
      return;
    }

    // Filter items with return quantity > 0
    const itemsToReturn = purchase.items
      .map((item) => {
        const key = `${item.productId}_${item.variationId || 'null'}`;
        const returnQty = returnQuantities[key] || 0;
        if (returnQty <= 0) return null;

        const originalQty = item.quantity ?? 0;
        const alreadyReturned = alreadyReturnedMap[key] || 0;
        if (returnQty > originalQty - alreadyReturned) {
          toast.error(`Return quantity exceeds available quantity for ${item.productName}`);
          return null;
        }

        // Get packing details from original item
        const originalPacking = item.packing_details || item.packingDetails || {};
        
        // Proportional packing (fallback when dialog not used); piece-level from dialog is in state returnPackingDetails[key]
        let proportionalPacking: any = null;
        let returnPackingQuantity: number | undefined = undefined;
        const savedReturnPackingFromDialog = returnPackingDetails[key];
        
        if (originalPacking && originalQty > 0) {
          const returnRatio = returnQty / originalQty;
          const originalBoxes = originalPacking.total_boxes || 0;
          const originalPieces = originalPacking.total_pieces || 0;
          const originalMeters = originalPacking.total_meters || 0;
          proportionalPacking = {
            ...originalPacking,
            total_boxes: Math.round(originalBoxes * returnRatio * 100) / 100,
            total_pieces: Math.round(originalPieces * returnRatio * 100) / 100,
            total_meters: Math.round(originalMeters * returnRatio * 100) / 100,
          };
          if ((item as any).packing_quantity) {
            returnPackingQuantity = Number((item as any).packing_quantity) * returnRatio;
          }
        }
        
        return {
          product_id: item.productId,
          variation_id: item.variationId || undefined,
          product_name: item.productName,
          sku: item.sku || 'N/A',
          quantity: returnQty,
          unit: item.unit || 'pcs',
          unit_price: item.price,
          total: returnQty * item.price,
          packing_type: (item as any).packing_type || undefined,
          packing_quantity: returnPackingQuantity || (item as any).packing_quantity || undefined,
          packing_unit: (item as any).packing_unit || undefined,
          packing_details: proportionalPacking || originalPacking || null,
          return_packing_details: savedReturnPackingFromDialog || null,
        };
      })
      .filter(Boolean) as any[];

    if (itemsToReturn.length === 0) {
      toast.error('Select at least one item and quantity to return');
      return;
    }

    try {
      setSavingReturn(true);
      const returnData = {
        company_id: companyId,
        branch_id: branchId,
        original_purchase_id: purchase.id,
        return_date: returnDate.toISOString().split('T')[0],
        supplier_id: purchase.supplier,
        supplier_name: purchase.supplierName || 'Unknown Supplier',
        items: itemsToReturn,
        reason: returnReason || null,
        notes: returnNotes || null,
        created_by: user.id,
      };

      await purchaseReturnService.createPurchaseReturn(returnData);
      toast.success('Purchase return created and finalized successfully');
      
      // Reload purchase data
      await reloadPurchaseData();
      
      // Exit return mode
      handleExitReturnMode();
    } catch (error: any) {
      console.error('[VIEW PURCHASE] Error creating return:', error);
      toast.error(error?.message || 'Failed to create purchase return');
    } finally {
      setSavingReturn(false);
    }
  };

  // CRITICAL FIX: Reload purchase data (called after payment is added)
  const reloadPurchaseData = useCallback(async () => {
    if (!purchaseId) return;
    try {
      const purchaseData = await purchaseService.getPurchase(purchaseId);
      if (purchaseData) {
        const convertedPurchase = convertFromSupabasePurchase(purchaseData);
        setPurchase(convertedPurchase);
        await loadPayments(purchaseData.id);
        await loadActivityLogs(purchaseData.id);
      }
    } catch (error: any) {
      console.error('[VIEW PURCHASE] Error reloading purchase:', error?.message || error);
    }
  }, [purchaseId, loadPayments, loadActivityLogs]);
  
  // CRITICAL FIX: Listen for payment added event
  useEffect(() => {
    const handlePaymentAdded = () => {
      if (purchaseId) {
        reloadPurchaseData();
      }
    };
    
    window.addEventListener('paymentAdded', handlePaymentAdded);
    return () => {
      window.removeEventListener('paymentAdded', handlePaymentAdded);
    };
  }, [purchaseId, reloadPurchaseData]);

  // Load purchase returns when purchase is final/received (so effective status can show Returned/Partially Returned)
  useEffect(() => {
    if (!companyId || !purchaseId || !purchase) return;
    const isFinalOrReceived = (purchase.status || '').toString().toLowerCase() === 'final' || (purchase.status || '').toString().toLowerCase() === 'received';
    if (!isFinalOrReceived) {
      setPurchaseReturns([]);
      return;
    }
    setLoadingPurchaseReturns(true);
    purchaseReturnService.getPurchaseReturns(companyId, contextBranchId === 'all' ? undefined : contextBranchId)
      .then((list) => {
        const forThisPurchase = (list || []).filter((r: any) => r.original_purchase_id === purchaseId || r.original_purchase_id === purchase.id);
        setPurchaseReturns(forThisPurchase);
        if (forThisPurchase.length > 0) {
          setPurchase((prev) => {
            if (!prev) return null;
            const count = forThisPurchase.length;
            if ((prev as any).hasReturn && (prev as any).returnCount === count) return prev;
            return { ...prev, hasReturn: true, returnCount: count } as Purchase;
          });
        }
      })
      .catch(() => setPurchaseReturns([]))
      .finally(() => setLoadingPurchaseReturns(false));
  }, [companyId, purchaseId, contextBranchId, purchase?.id, (purchase as any)?.status]);

  if (!isOpen || !purchaseId) return null;

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
        <div className="text-white">Loading purchase details...</div>
      </div>
    );
  }

  if (!purchase) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
        <div className="text-white">Purchase not found</div>
        <Button onClick={onClose} className="ml-4">Close</Button>
      </div>
    );
  }

  const effectiveStatus = getEffectivePurchaseStatus(purchase);
  const isCancelled = effectiveStatus === 'cancelled';
  const statusBadgeConfig = getPurchaseStatusBadgeConfig(purchase);
  const badge = statusBadgeConfig?.bg != null ? statusBadgeConfig : { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30', label: 'Draft' };
  const purchaseDue = (purchase as any).due ?? (purchase as any).paymentDue ?? 0;
  const canAddPayment = canAddPaymentToPurchase(purchase, purchaseDue);

  const getStatusColor = (status: string) => {
    const s = (status || '').toLowerCase();
    switch (s) {
      case 'final':
      case 'completed':
      case 'received': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'ordered': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'draft': return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
      case 'cancelled': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'returned': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'partially_returned': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-500/10 text-green-500';
      case 'partial': return 'bg-yellow-500/10 text-yellow-500';
      case 'unpaid': return 'bg-red-500/10 text-red-500';
      default: return 'bg-gray-500/10 text-gray-500';
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full md:w-[1100px] bg-gray-950 shadow-2xl z-50 overflow-hidden flex flex-col border-l border-gray-800">
        {/* Cancelled banner - when purchase is cancelled */}
        {isCancelled && (
          <div className="shrink-0 bg-amber-500/20 border-b border-amber-500/30 px-6 py-3 flex items-center gap-2">
            <X size={18} className="text-amber-500" />
            <span className="font-semibold text-amber-200 uppercase tracking-wide">Cancelled Purchase Order</span>
            <span className="text-amber-300/90 text-sm">Reversed entry created.</span>
          </div>
        )}
        {/* Header: In return mode show "Purchase Return · Ref: ..."; otherwise normal purchase title */}
        <div className="bg-gray-900/80 border-b border-gray-800 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-3">
                {returnMode ? (
                  <>
                    Purchase Return <span className="text-gray-400 font-normal">· Ref: {purchase.purchaseNo}</span>
                    <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs font-semibold">Return Mode</Badge>
                  </>
                ) : (
                  <>
                    {purchase.purchaseNo}
                    <Badge className={cn("text-xs font-semibold border", badge.bg, badge.text, badge.border)}>
                      {badge.label}
                    </Badge>
                  </>
                )}
              </h2>
              <p className="text-sm text-gray-400 mt-0.5">
                {returnMode ? 'Return items from this purchase. Only return quantities are editable.' : 'Purchase Transaction Details'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Action Buttons */}
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-white hover:bg-gray-800"
              onClick={() => {
                setShowPrintLayout(true);
                onPrint?.(purchase.id);
              }}
            >
              <Printer size={16} className="mr-2" />
              Print
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-white hover:bg-gray-800"
                >
                  <MoreVertical size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-gray-900 border-gray-800 text-white">
                {!isCancelled && (
                  <DropdownMenuItem 
                    className="hover:bg-gray-800 cursor-pointer"
                    onClick={() => onEdit?.(purchase.id)}
                  >
                    <Edit size={14} className="mr-2" />
                    Edit Purchase
                  </DropdownMenuItem>
                )}
                {!isCancelled && (purchase.status === 'final' || purchase.status === 'received') && effectiveStatus !== 'cancelled' && (
                  <DropdownMenuItem 
                    className="hover:bg-gray-800 cursor-pointer"
                    onClick={() => onOpenReturn ? onOpenReturn() : handleEnterReturnMode()}
                  >
                    <RotateCcw size={14} className="mr-2 text-purple-400" />
                    Return Items
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className="hover:bg-gray-800 cursor-pointer">
                  <Download size={14} className="mr-2" />
                  Export PDF
                </DropdownMenuItem>
                <DropdownMenuItem className="hover:bg-gray-800 cursor-pointer">
                  <Share2 size={14} className="mr-2" />
                  Share
                </DropdownMenuItem>
                {canDelete && !isCancelled && (
                <DropdownMenuItem 
                  className="hover:bg-gray-800 cursor-pointer text-red-400"
                  onClick={() => onDelete?.(purchase.id)}
                >
                  <Trash2 size={14} className="mr-2" />
                  Delete
                </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

          <Button
            variant="ghost"
            size="icon"
              className="text-gray-400 hover:text-white"
            onClick={onClose}
          >
            <X size={20} />
          </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-gray-900/50 border-b border-gray-800 px-6 shrink-0">
          <div className="flex gap-1">
            {[
              { id: 'details', label: 'Details' },
              { id: 'payments', label: 'Payments' },
              { id: 'history', label: 'History' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "px-4 py-3 text-sm font-medium transition-colors relative",
                  activeTab === tab.id
                    ? "text-blue-400"
                    : "text-gray-500 hover:text-gray-300"
                )}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'details' && (
            <>
              {/* Supplier & Transaction Info — HIDDEN in return mode (Option C: no duplicate customer/supplier info) */}
              {!returnMode && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Supplier Info */}
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4 flex items-center gap-2">
                    <User size={16} />
                    Supplier Information
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Supplier Name</p>
                      <p className="text-white font-medium">{purchase.supplierName}</p>
                      {supplierCode && (
                        <p className="text-sm text-gray-400">Code: {supplierCode}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Contact Number</p>
                      <p className="text-white flex items-center gap-2">
                        <Phone size={14} className="text-gray-500" />
                        {purchase.contactNumber || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Transaction Info */}
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4 flex items-center gap-2">
                    <FileText size={16} />
                    Transaction Details
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <span className="text-xs text-gray-500 block mb-1">Date</span>
                      <div className="text-white flex items-center gap-2">
                        <Calendar size={14} className="text-gray-500" />
                        <div>
                          <div>{formatDate(purchase.date)}</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {formatDateTime(purchase.createdAt)}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">Location</span>
                      <span className="text-white flex items-center gap-2">
                        <Building2 size={14} className="text-gray-500" />
                        {branchMap.get(purchase.branchId || '') || purchase.location}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">Created At</span>
                      <span className="text-white">{formatDateTime(purchase.createdAt)}</span>
                    </div>
                    {purchase.updatedAt && (
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-500">Last Updated</span>
                        <span className="text-white">{formatDateTime(purchase.updatedAt)}</span>
                    </div>
                    )}
                  </div>
                </div>
              </div>
              )}

              {/* Status Cards — hidden in return mode */}
              {!returnMode && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-2">Payment Status</p>
                  <Badge className={cn("text-sm font-semibold", getPaymentStatusColor(purchase.paymentStatus))}>
                    {purchase.paymentStatus === 'paid' ? 'Paid' : purchase.paymentStatus === 'partial' ? 'Partial' : 'Unpaid'}
                  </Badge>
                </div>
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-2">Order Status</p>
                  <Badge className={cn("text-sm font-semibold", badge.bg, badge.text, badge.border)}>
                    {badge.label}
                  </Badge>
                </div>
              </div>
              )}

              {/* Purchase Returns - when this purchase has returns (from API or after loading list) */}
              {((purchase as any).hasReturn || purchaseReturns.length > 0) && (
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
                  <div className="px-5 py-3 bg-gray-950/50 border-b border-gray-800 flex items-center gap-2">
                    <RotateCcw size={16} className="text-purple-400" />
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Purchase Returns</h3>
                    {loadingPurchaseReturns && <span className="text-xs text-gray-500">Loading...</span>}
                  </div>
                  <div className="p-4">
                    {loadingPurchaseReturns ? (
                      <p className="text-sm text-gray-500">Loading returns...</p>
                    ) : purchaseReturns.length === 0 ? (
                      <p className="text-sm text-gray-500">No returns found for this purchase.</p>
                    ) : (
                      <ul className="space-y-2">
                        {purchaseReturns.map((ret: any) => {
                          const retStatus = (ret.status || '').toString().toLowerCase();
                          const statusLabel = retStatus === 'void' ? 'Voided' : retStatus === 'final' ? 'Final' : 'Draft';
                          const statusClass = retStatus === 'void' ? 'bg-gray-500/20 text-gray-400 border-gray-500/30' : retStatus === 'final' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
                          return (
                            <li key={ret.id} className="flex items-center justify-between py-2 border-b border-gray-800/50 last:border-0">
                              <span className="text-sm font-medium text-white font-mono">{ret.return_no || ret.id || '—'}</span>
                              <Badge className={cn('text-xs', statusClass)}>{statusLabel}</Badge>
                              <span className="text-xs text-gray-500">{ret.return_date ? new Date(ret.return_date).toLocaleDateString() : ''}</span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {/* Items Table */}
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
                <div className="px-5 py-3 bg-gray-950/50 border-b border-gray-800 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-2">
                    <Package size={16} />
                    Items ({purchase.items.length})
                    {returnMode && (
                      <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 ml-2">
                        Return Mode
                      </Badge>
                    )}
                  </h3>
                  {!returnMode && !isCancelled && (purchase.status === 'final' || purchase.status === 'received') && effectiveStatus !== 'cancelled' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-purple-500/30 text-purple-400 hover:bg-purple-500/20"
                      onClick={() => onOpenReturn ? onOpenReturn() : handleEnterReturnMode()}
                    >
                      <RotateCcw size={14} className="mr-2" />
                      Return Items
                    </Button>
                  )}
                  {returnMode && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
                        onClick={() => setItemSelectionDialogOpen(true)}
                        disabled={savingReturn}
                      >
                        Select items (dialog)
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-gray-700 text-gray-300 hover:bg-gray-800"
                        onClick={handleExitReturnMode}
                        disabled={savingReturn}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                        onClick={handleSaveReturn}
                        disabled={savingReturn || Object.values(returnQuantities).every(qty => qty <= 0)}
                      >
                        {savingReturn ? (
                          <>
                            <Loader2 size={14} className="mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save size={14} className="mr-2" />
                            Save Return
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-800 hover:bg-transparent">
                        <TableHead className="text-gray-400">Product</TableHead>
                        <TableHead className="text-gray-400">SKU</TableHead>
                        <TableHead className="text-gray-400">Variation</TableHead>
                        {enablePacking && <TableHead className="text-gray-400">Packing</TableHead>}
                        <TableHead className="text-gray-400 text-right">Unit Price</TableHead>
                        <TableHead className="text-gray-400 text-center">Original Qty</TableHead>
                        {returnMode && <TableHead className="text-gray-400 text-center">Already Returned</TableHead>}
                        {returnMode && <TableHead className="text-gray-400 text-center">Return Qty</TableHead>}
                        {!returnMode && <TableHead className="text-gray-400 text-center">Qty</TableHead>}
                        <TableHead className="text-gray-400">Unit</TableHead>
                        {returnMode && <TableHead className="text-gray-400 text-right">Return Total</TableHead>}
                        {!returnMode && <TableHead className="text-gray-400 text-right">Total</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchase.items.map((item) => {
                        const productName = item.productName || 'Unknown Product';
                        const displaySku = item.sku || 'N/A';
                        const qty = item.quantity ?? 0;
                        
                        // Extract variation data
                        const variation = (item as any).variation || (item as any).product_variations || null;
                        const variationAttrs = variation?.attributes || {};
                        const variationSku = variation?.sku || null;
                        const variationText = variationAttrs 
                          ? Object.entries(variationAttrs)
                              .filter(([_, v]) => v != null && v !== '')
                              .map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)}: ${v}`)
                              .join(', ')
                          : null;
                        
                        // Packing: from DB packing_details or packingDetails (jo purchase save hua tha wahi)
                        const pd = item.packing_details || item.packingDetails || {};
                        const totalBoxes = pd.total_boxes ?? 0;
                        const totalPieces = pd.total_pieces ?? 0;
                        const unitDisplay = item.unit ?? 'pcs';
                        
                        // Use variation SKU if available, otherwise use product SKU
                        const finalSku = variationSku || displaySku;

                        // Return mode calculations
                        const itemKey = `${item.productId}_${item.variationId || 'null'}`;
                        const alreadyReturned = alreadyReturnedMap[itemKey] || 0;
                        const maxReturnable = qty - alreadyReturned;
                        const canReturn = maxReturnable > 0;
                        const returnQty = returnQuantities[itemKey] !== undefined && returnQuantities[itemKey] !== null 
                          ? Number(returnQuantities[itemKey]) 
                          : 0;

                        // Packing display: Show return packing if selected, otherwise calculate from returnQty, or show original
                        let packingText = '—';
                        const savedReturnPacking = returnPackingDetails[itemKey];
                        const hasPackingStructure = (pd.boxes && pd.boxes.length > 0) || (pd.loose_pieces && pd.loose_pieces.length > 0);
                        const returnQtyFromPacking = hasPackingStructure && savedReturnPacking ? Number(savedReturnPacking.returned_total_meters ?? 0) : returnQty;
                        
                        if (returnMode && savedReturnPacking) {
                          // Show saved return packing details (piece-level selection)
                          const returnPackingParts: string[] = [];
                          if (savedReturnPacking.returned_boxes > 0) {
                            returnPackingParts.push(`${formatBoxesPieces(savedReturnPacking.returned_boxes)} Box${Math.round(Number(savedReturnPacking.returned_boxes)) !== 1 ? 'es' : ''}`);
                          }
                          if (savedReturnPacking.returned_pieces_count > 0) {
                            returnPackingParts.push(`${formatBoxesPieces(savedReturnPacking.returned_pieces_count)} Piece${Math.round(Number(savedReturnPacking.returned_pieces_count)) !== 1 ? 's' : ''}`);
                          }
                          if (savedReturnPacking.returned_total_meters > 0) {
                            returnPackingParts.push(`${savedReturnPacking.returned_total_meters.toFixed(2)} M`);
                          }
                          packingText = returnPackingParts.length ? returnPackingParts.join(', ') : '—';
                        } else if (returnMode && returnQty > 0 && qty > 0) {
                          // Calculate proportional packing from returnQty (sync with quantity)
                          const returnRatio = returnQty / qty;
                          const returnBoxes = Math.round(totalBoxes * returnRatio * 100) / 100;
                          const returnPieces = Math.round(totalPieces * returnRatio * 100) / 100;
                          const returnMeters = pd.total_meters ? Math.round((pd.total_meters * returnRatio) * 100) / 100 : 0;
                          
                          const returnPackingParts: string[] = [];
                          if (Number(returnBoxes) > 0) returnPackingParts.push(`${formatBoxesPieces(returnBoxes)} Box${Math.round(Number(returnBoxes)) !== 1 ? 'es' : ''}`);
                          if (Number(returnPieces) > 0) returnPackingParts.push(`${formatBoxesPieces(returnPieces)} Piece${Math.round(Number(returnPieces)) !== 1 ? 's' : ''}`);
                          if (returnMeters > 0) returnPackingParts.push(`${returnMeters.toFixed(2)} M`);
                          packingText = returnPackingParts.length ? returnPackingParts.join(', ') : '—';
                        } else {
                          // Show original packing
                          const packingParts: string[] = [];
                          if (Number(totalBoxes) > 0) packingParts.push(`${formatBoxesPieces(totalBoxes)} Box${Math.round(Number(totalBoxes)) !== 1 ? 'es' : ''}`);
                          if (Number(totalPieces) > 0) packingParts.push(`${formatBoxesPieces(totalPieces)} Piece${Math.round(Number(totalPieces)) !== 1 ? 's' : ''}`);
                          packingText = packingParts.length ? packingParts.join(', ') : '—';
                        }
                        
                        return (
                        <TableRow key={item.id} className={cn("border-gray-800", returnMode && !canReturn && "opacity-50")}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-white">{productName}</p>
                              {finalSku && finalSku !== 'N/A' && (
                                <p className="text-xs text-gray-500">SKU: {finalSku}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-gray-400">{finalSku}</TableCell>
                          <TableCell>
                            {variationText ? (
                              <span className="text-gray-300 text-sm">{variationText}</span>
                            ) : (
                              <span className="text-gray-600">—</span>
                            )}
                          </TableCell>
                          {enablePacking && (
                            <TableCell className="text-gray-400">
                              <button
                                onClick={() => handleOpenPackingModal(item)}
                                className="text-left hover:text-purple-400 transition-colors cursor-pointer"
                              >
                                {returnMode && returnQty > 0 ? (
                                  <span className="text-purple-400 font-medium">{packingText}</span>
                                ) : (
                                  <span>{packingText}</span>
                                )}
                              </button>
                            </TableCell>
                          )}
                          <TableCell className="text-right text-white">
                            {formatCurrency(item.price)}
                          </TableCell>
                          <TableCell className="text-center text-white font-medium">
                            {qty}
                          </TableCell>
                          {returnMode && (
                            <TableCell className="text-center">
                              {alreadyReturned > 0 ? (
                                <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                                  {alreadyReturned}
                                </Badge>
                              ) : (
                                <span className="text-gray-500">0</span>
                              )}
                            </TableCell>
                          )}
                          {returnMode ? (
                            <TableCell className="text-center">
                              {hasPackingStructure ? (
                                /* Read-only: value only from Return Packing dialog */
                                <div className="flex flex-col items-center gap-0.5">
                                  <div className="flex items-center justify-center gap-1 rounded bg-gray-800/80 border border-amber-500/40 px-2 py-1.5 min-w-[4rem]">
                                    <span className="text-sm font-medium text-white tabular-nums">{returnQtyFromPacking}</span>
                                  </div>
                                  <p className="text-[10px] text-amber-400/90">From Return Packing</p>
                                  {!canReturn && (
                                    <p className="text-xs text-red-400 mt-0.5">Fully returned</p>
                                  )}
                                </div>
                              ) : (
                                <>
                                  <input
                                    type="number"
                                    min={0}
                                    max={maxReturnable}
                                    value={returnQty}
                                    onChange={(e) => {
                                      const val = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                                      handleReturnQuantityChange(itemKey, val);
                                    }}
                                    disabled={!canReturn}
                                    className="w-20 text-center bg-gray-900 border border-gray-700 text-white h-8 mx-auto font-medium rounded-md px-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                    placeholder="0"
                                  />
                                  {!canReturn && (
                                    <p className="text-xs text-red-400 mt-1">Fully returned</p>
                                  )}
                                </>
                              )}
                            </TableCell>
                          ) : (
                            <TableCell className="text-center text-white font-medium">
                              {qty}
                            </TableCell>
                          )}
                          <TableCell className="text-gray-400">{unitDisplay}</TableCell>
                          {returnMode ? (
                            <TableCell className="text-right text-red-400 font-medium">
                              {returnQtyFromPacking > 0 ? `-${formatCurrency(returnQtyFromPacking * item.price)}` : '—'}
                            </TableCell>
                          ) : (
                            <TableCell className="text-right text-white font-medium">
                              {formatCurrency(item.price * qty)}
                            </TableCell>
                          )}
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  </div>
                </div>

              {/* Return Mode: Reason & Notes */}
              {returnMode && (
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 space-y-4">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-2">
                    <RotateCcw size={16} />
                    Return Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-200 mb-2 block">Return Date *</Label>
                      <CalendarDatePicker 
                        value={returnDate} 
                        onChange={(d) => d && setReturnDate(d)} 
                        className="bg-gray-800 border-gray-700 text-white" 
                      />
                    </div>
                    <div>
                      <Label className="text-gray-200 mb-2 block">Reason (optional)</Label>
                      <Input 
                        value={returnReason} 
                        onChange={(e) => setReturnReason(e.target.value)} 
                        placeholder="Reason for return" 
                        className="bg-gray-800 border-gray-700 text-white" 
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-gray-200 mb-2 block">Notes (optional)</Label>
                    <Textarea 
                      value={returnNotes} 
                      onChange={(e) => setReturnNotes(e.target.value)} 
                      placeholder="Additional notes" 
                      className="bg-gray-800 border-gray-700 text-white min-h-[60px]" 
                    />
                  </div>
                  <div className="pt-2 border-t border-gray-800">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Amounts</h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">Original Purchase Amount</p>
                        <p className="text-lg font-bold text-green-400">{formatCurrency(purchase.total)}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">Reference only</p>
                      </div>
                      <div className="border-t border-gray-800 pt-3">
                        <p className="text-xs text-gray-500 mb-0.5">Returned Amount</p>
                        <p className="text-lg font-bold text-red-400">
                          - {formatCurrency(Object.entries(returnQuantities).reduce((sum, [key, qty]) => {
                            const item = purchase.items.find((it) => {
                              const itemKey = `${it.productId}_${it.variationId || 'null'}`;
                              return itemKey === key;
                            });
                            return sum + (qty * (item?.price || 0));
                          }, 0))}
                        </p>
                        <p className="text-[10px] text-gray-500 mt-0.5">Supplier credit impact</p>
                      </div>
                      <div className="border-t border-gray-800 pt-3">
                        <p className="text-xs text-gray-500 mb-0.5">Net After Return</p>
                        <p className="text-lg font-bold text-white">
                          {formatCurrency(Math.max(0, purchase.total - Object.entries(returnQuantities).reduce((sum, [key, qty]) => {
                            const item = purchase.items.find((it) => {
                              const itemKey = `${it.productId}_${it.variationId || 'null'}`;
                              return itemKey === key;
                            });
                            return sum + (qty * (item?.price || 0));
                          }, 0)))}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Summary — hidden in return mode (amounts in Return Details) */}
              {!returnMode && (
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
                <div className="px-5 py-3 bg-gray-950/50 border-b border-gray-800">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-2">
                    <DollarSign size={16} />
                    Payment Summary
                  </h3>
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Subtotal</span>
                    <span className="text-white font-medium">{formatCurrency(purchase.subtotal)}</span>
                  </div>
                  
                  {purchase.discount && purchase.discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Discount</span>
                      <span className="text-red-400 font-medium">- {formatCurrency(purchase.discount)}</span>
                    </div>
                  )}
                  
                  {purchase.tax && purchase.tax > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Tax</span>
                      <span className="text-white font-medium">{formatCurrency(purchase.tax)}</span>
                    </div>
                  )}
                  
                  {purchase.shippingCost && purchase.shippingCost > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Shipping Charges</span>
                      <span className="text-white font-medium">{formatCurrency(purchase.shippingCost)}</span>
                    </div>
                  )}
                  
                  <Separator className="bg-gray-800" />
                  
                  <div className="flex justify-between">
                    <span className="text-gray-300 font-semibold">Grand Total</span>
                    <span className="text-white text-xl font-bold">{formatCurrency(purchase.total)}</span>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Total Paid</span>
                    <span className="text-green-400 font-medium">{formatCurrency(purchase.paid)}</span>
                  </div>
                  
                  {purchase.due > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-400 font-medium">Amount Due</span>
                      <span className="text-red-400 text-lg font-bold">{formatCurrency(purchase.due)}</span>
                    </div>
                  )}
                </div>
              </div>
              )}

              {/* Notes */}
              {purchase.notes && (
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Notes</h3>
                  <p className="text-white text-sm leading-relaxed">{purchase.notes}</p>
                </div>
              )}

              {/* Attachments */}
              {(() => {
                const hasAttachments = purchase.attachments && (
                  Array.isArray(purchase.attachments) 
                    ? purchase.attachments.length > 0 
                    : !!purchase.attachments
                );
                
                if (!hasAttachments) {
                  return null;
                }
                
                return (
                  <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <Paperclip size={16} />
                      Attachments ({Array.isArray(purchase.attachments) ? purchase.attachments.length : 1})
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {Array.isArray(purchase.attachments) ? (
                        purchase.attachments.map((att: any, idx: number) => {
                          const url = typeof att === 'string' ? att : (att?.url || att?.fileUrl || '');
                          const name = typeof att === 'object' && att?.name ? att.name : (typeof att === 'object' && (att?.fileName || att?.file_name) ? (att.fileName || att.file_name) : `Attachment ${idx + 1}`);
                          if (!url) {
                            console.warn('[VIEW PURCHASE] Attachment missing URL:', att);
                            return null;
                          }
                          const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(name || '');
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={async () => {
                                const openUrl = await getAttachmentOpenUrl(url);
                                window.open(openUrl, '_blank');
                              }}
                              className="inline-flex items-center gap-2 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-400 text-sm transition-colors"
                            >
                              {isImage ? <ImageIcon size={16} /> : <File size={16} />}
                              <span>{name}</span>
                            </button>
                          );
                        })
                      ) : typeof purchase.attachments === 'string' ? (
                        <button
                          type="button"
                          onClick={async () => {
                            const openUrl = await getAttachmentOpenUrl(purchase.attachments as string);
                            window.open(openUrl, '_blank');
                          }}
                          className="inline-flex items-center gap-2 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-400 text-sm transition-colors"
                        >
                          <Paperclip size={16} />
                          <span>View attachment</span>
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })()}
            </>
          )}

          {activeTab === 'payments' && (
            <div className="space-y-4">
              {/* Same as ViewSaleDetailsDrawer: Payment History + Add Payment + breakdown */}
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-white">Payment History</h3>
                {canAddPayment && (
                  <Button
                    onClick={() => {
                      onAddPayment?.(purchase.id);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <CreditCard size={16} className="mr-2" />
                    Add Payment
                  </Button>
                )}
              </div>

              {loadingPayments ? (
                <div className="text-center py-12 text-gray-400">Loading payments...</div>
              ) : payments.length > 0 ? (
                <div className="space-y-4">
                  {/* Summary Cards by Payment Method */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {payments.filter((p: any) => p.method === 'cash').length > 0 && (
                      <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                        <p className="text-xs text-gray-400 mb-1">Paid (Cash)</p>
                        <p className="text-2xl font-bold text-green-400">
                          {formatCurrency(payments.filter((p: any) => p.method === 'cash').reduce((sum: number, p: any) => sum + p.amount, 0))}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {payments.filter((p: any) => p.method === 'cash').length} payment(s)
                        </p>
                      </div>
                    )}
                    {payments.filter((p: any) => p.method === 'bank' || p.method === 'card').length > 0 && (
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                        <p className="text-xs text-gray-400 mb-1">Paid (Bank/Card)</p>
                        <p className="text-2xl font-bold text-blue-400">
                          {formatCurrency(payments.filter((p: any) => p.method === 'bank' || p.method === 'card').reduce((sum: number, p: any) => sum + p.amount, 0))}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {payments.filter((p: any) => p.method === 'bank' || p.method === 'card').length} payment(s)
                        </p>
                      </div>
                    )}
                    {payments.filter((p: any) => p.method === 'other' || (p.method !== 'cash' && p.method !== 'bank' && p.method !== 'card')).length > 0 && (
                      <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
                        <p className="text-xs text-gray-400 mb-1">Paid (Other)</p>
                        <p className="text-2xl font-bold text-purple-400">
                          {formatCurrency(payments.filter((p: any) => p.method === 'other' || (p.method !== 'cash' && p.method !== 'bank' && p.method !== 'card')).reduce((sum: number, p: any) => sum + p.amount, 0))}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {payments.filter((p: any) => p.method === 'other' || (p.method !== 'cash' && p.method !== 'bank' && p.method !== 'card')).length} payment(s)
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <p className="text-white font-semibold text-xl">
                          {formatCurrency(purchase.paid)}
                        </p>
                        <p className="text-sm text-gray-400 mt-1">Total Paid Amount</p>
                      </div>
                      <Badge className={cn(
                        "text-sm font-semibold",
                        purchase.paymentStatus === 'paid' ? "bg-green-500/10 text-green-400 border-green-500/20" :
                        purchase.paymentStatus === 'partial' ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
                        "bg-red-500/10 text-red-400 border-red-500/20"
                      )}>
                        {purchase.paymentStatus === 'paid' ? 'Paid' : purchase.paymentStatus === 'partial' ? 'Partial' : 'Unpaid'}
                      </Badge>
                    </div>
                    {purchase.due > 0 && (
                      <div className="flex justify-between text-sm pt-3 border-t border-gray-800">
                        <span className="text-gray-400">Amount Due:</span>
                        <span className="text-red-400 font-medium">{formatCurrency(purchase.due)}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-gray-400 uppercase">Payment Details</h4>
                    {payments.map((payment: any) => (
                      <div key={payment.id} className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-white font-semibold">{formatCurrency(payment.amount)}</p>
                              {payment.referenceNo && (
                                <code className="text-xs bg-gray-800 px-2 py-0.5 rounded text-blue-400 border border-gray-700">
                                  {payment.referenceNo}
                                </code>
                              )}
                            </div>
                            <p className="text-sm text-gray-400">
                              {formatDate(payment.date)}
                            </p>
                            {payment.accountName && (
                              <p className="text-xs text-gray-500 mt-1">Account: {payment.accountName}</p>
                            )}
                            {payment.notes && (
                              <p className="text-xs text-gray-400 mt-2 flex items-start gap-1.5">
                                <FileText size={12} className="text-gray-500 shrink-0 mt-0.5" />
                                <span><span className="text-gray-500">Note:</span> {payment.notes}</span>
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {payment.attachments && (Array.isArray(payment.attachments) ? payment.attachments.length > 0 : !!payment.attachments) && (
                              <button
                                type="button"
                                onClick={() => {
                                  const list: { url: string; name: string }[] = [];
                                  const raw = payment.attachments;
                                  const arr = Array.isArray(raw) ? raw : (typeof raw === 'string' ? [{ url: raw, name: 'Attachment' }] : []);
                                  arr.forEach((att: any) => {
                                    const url = typeof att === 'string' ? att : (att?.url ?? att?.fileUrl ?? '');
                                    const name = typeof att === 'object' && att?.name ? att.name : (typeof att === 'object' && (att?.fileName || att?.file_name) ? (att.fileName || att.file_name) : 'Attachment');
                                    if (url) list.push({ url: String(url), name: name || 'Attachment' });
                                  });
                                  if (list.length) setAttachmentsDialogList(list);
                                }}
                                className="p-1.5 rounded-lg hover:bg-amber-500/20 text-gray-400 hover:text-amber-400 transition-colors"
                                title={`${Array.isArray(payment.attachments) ? payment.attachments.length : 1} attachment(s)`}
                              >
                                <Paperclip size={14} />
                              </button>
                            )}
                            <Badge className={cn(
                              "text-xs font-semibold",
                              payment.method === 'cash' ? "bg-green-500/10 text-green-400 border-green-500/20" :
                              payment.method === 'bank' || payment.method === 'card' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                              "bg-purple-500/10 text-purple-400 border-purple-500/20"
                            )}>
                              {payment.method === 'cash' ? 'Cash' : payment.method === 'bank' ? 'Bank' : payment.method === 'card' ? 'Card' : 'Other'}
                            </Badge>
                            {!isCancelled && (
                              <>
                            <button
                              onClick={() => {
                                setPaymentToEdit(payment);
                                setEditPaymentDialogOpen(true);
                              }}
                              className="p-1.5 rounded-lg hover:bg-blue-500/20 text-gray-400 hover:text-blue-400 transition-colors"
                              title="Edit Payment"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => {
                                setPaymentToDelete(payment);
                                setDeleteConfirmationOpen(true);
                              }}
                              className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Delete Payment"
                              disabled={isDeletingPayment || loadingPayments}
                            >
                              <Trash2 size={14} />
                            </button>
                              </>
                            )}
                          </div>
                        </div>
                        {(payment.attachments && (Array.isArray(payment.attachments) ? payment.attachments.length > 0 : !!payment.attachments)) && (
                          <div className="mt-3 pt-3 border-t border-gray-800 flex flex-wrap items-center gap-2">
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Paperclip size={12} /> Attachments:
                            </span>
                            {Array.isArray(payment.attachments) ? (
                              payment.attachments.map((att: any, idx: number) => {
                                const url = typeof att === 'string' ? att : (att?.url || att?.fileUrl || att?.href);
                                const name = typeof att === 'object' && att?.name ? att.name : (typeof att === 'object' && (att?.fileName || att?.file_name) ? (att.fileName || att.file_name) : `Attachment ${idx + 1}`);
                                if (!url) return null;
                                return (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={async () => {
                                      const openUrl = await getAttachmentOpenUrl(url);
                                      window.open(openUrl, '_blank');
                                    }}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-400 text-xs transition-colors"
                                  >
                                    <File size={14} />
                                    <span>{name}</span>
                                  </button>
                                );
                              })
                            ) : typeof payment.attachments === 'string' ? (
                              <button
                                type="button"
                                onClick={async () => {
                                  const openUrl = await getAttachmentOpenUrl(payment.attachments);
                                  window.open(openUrl, '_blank');
                                }}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-400 text-xs transition-colors"
                              >
                                <Paperclip size={14} />
                                <span>View attachment</span>
                              </button>
                            ) : null}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : purchase.paid > 0 ? (
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
                  <p className="text-white font-semibold text-lg">{formatCurrency(purchase.paid)}</p>
                  <p className="text-sm text-gray-400 mt-1">Total paid amount (payment details loading...)</p>
                </div>
              ) : (
                <div className="text-center py-12">
                  <CreditCard size={48} className="mx-auto text-gray-700 mb-4" />
                  <p className="text-gray-500">No payments recorded yet</p>
                  <Button onClick={() => setViewPaymentsModalOpen(true)} className="mt-4 bg-blue-600 hover:bg-blue-500 text-white">
                    <CreditCard size={16} className="mr-2" />
                    View Payment History
                  </Button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-white mb-4">Activity Timeline</h3>
              
              {loadingActivityLogs ? (
                <div className="text-center py-12 text-gray-400">Loading activity logs...</div>
              ) : activityLogs.length > 0 ? (
                <div className="space-y-4">
                  {activityLogs.map((log, index) => {
                    const getIcon = () => {
                      switch (log.action) {
                        case 'create':
                          return <FileText size={16} className="text-gray-500" />;
                        case 'status_change':
                          return <CheckCircle2 size={16} className="text-green-500" />;
                        case 'payment_added':
                          return <DollarSign size={16} className="text-blue-500" />;
                        case 'payment_deleted':
                          return <DollarSign size={16} className="text-red-500" />;
                        case 'update':
                          return <Edit size={16} className="text-yellow-500" />;
                        case 'delete':
                          return <Trash2 size={16} className="text-red-500" />;
                        default:
                          return <Clock size={16} className="text-gray-500" />;
                      }
                    };

                    const getBgColor = () => {
                      switch (log.action) {
                        case 'create':
                          return 'bg-gray-700/20';
                        case 'status_change':
                          return 'bg-green-500/20';
                        case 'payment_added':
                          return 'bg-blue-500/20';
                        case 'payment_deleted':
                          return 'bg-red-500/20';
                        case 'update':
                          return 'bg-yellow-500/20';
                        case 'delete':
                          return 'bg-red-500/20';
                        default:
                          return 'bg-gray-700/20';
                      }
                    };

                    return (
                      <div key={log.id || index} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className={`w-8 h-8 rounded-full ${getBgColor()} flex items-center justify-center`}>
                            {getIcon()}
                          </div>
                          {index < activityLogs.length - 1 && (
                            <div className="w-0.5 h-full bg-gray-800 mt-2" />
                          )}
                        </div>
                        <div className="flex-1 pb-6">
                          <p className="text-white font-medium">
                            {log.description || activityLogService.formatActivityLog(log)}
                          </p>
                          <p className="text-sm text-gray-400 mt-1">
                            {formatDateTime(log.created_at)}
                          </p>
                          {log.performed_by_name && (
                            <p className="text-sm text-gray-500 mt-1">
                              By: {log.performed_by_name}
                            </p>
                          )}
                          {log.field && log.old_value !== undefined && log.new_value !== undefined && (
                            <p className="text-sm text-gray-500 mt-1">
                              {log.field}: {String(log.old_value)} → {String(log.new_value)}
                            </p>
                          )}
                          {log.amount && (
                            <p className="text-sm text-gray-500 mt-1">
                              Amount: {formatCurrency(log.amount)} {log.payment_method && `via ${log.payment_method}`}
                            </p>
                      )}
                    </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Clock size={48} className="mx-auto text-gray-700 mb-4" />
                  <p className="text-gray-500">No activity logs found</p>
                  </div>
                )}
            </div>
            )}
          </div>

        {/* Footer Actions - Add Payment when allowed by effective status */}
        {activeTab === 'details' && canAddPayment && (
          <div className="border-t border-gray-800 px-6 py-4 bg-gray-900/50 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Amount Due</p>
                <p className="text-2xl font-bold text-red-400">{formatCurrency(purchase.due)}</p>
              </div>
          <Button
                onClick={() => onAddPayment?.(purchase.id)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
          >
                <CreditCard size={16} className="mr-2" />
                Add Payment
          </Button>
        </div>
      </div>
        )}
      </div>

      {/* Print Layout Modal */}
      {showPrintLayout && purchase && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
            <PurchaseOrderPrintLayout 
              purchase={purchase} 
              onClose={() => setShowPrintLayout(false)}
            />
      </div>
    </div>
      )}

      {/* Payment Delete Confirmation Modal */}
      {paymentToDelete && (
        <PaymentDeleteConfirmationModal
          isOpen={deleteConfirmationOpen}
          onClose={() => {
            setDeleteConfirmationOpen(false);
            setPaymentToDelete(null);
          }}
          onConfirm={async () => {
            if (!paymentToDelete || !purchase || !companyId) return;
            
            setIsDeletingPayment(true);
            try {
              const deletePromise = purchaseService.deletePayment(paymentToDelete.id, purchase.id);
              const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Payment deletion timed out. Please try again.')), 15000)
              );
              
              await Promise.race([deletePromise, timeoutPromise]);
              
              // CRITICAL FIX: Log activity (module 'purchase' so it appears in purchase Activity Timeline)
              if (companyId) {
                try {
                  await activityLogService.logActivity({
                    companyId,
                    module: 'purchase',
                    entityId: purchase.id,
                    entityReference: purchase.purchaseNo,
                    action: 'payment_deleted',
                    amount: paymentToDelete.amount,
                    paymentMethod: paymentToDelete.method,
                    performedBy: user?.id || undefined,
                    description: `Payment of ${formatCurrency(paymentToDelete.amount)} deleted from purchase ${purchase.purchaseNo}`,
                  });
                  await loadActivityLogs(purchase.id);
                } catch (logError) {
                  console.error('[VIEW PURCHASE] Error logging payment deletion:', logError);
                }
              }

              toast.success('Payment deleted successfully. Reverse entry created.');

              // Use purchase.id (database UUID) for payment operations
              if (purchase?.id) {
                await Promise.all([
                  loadPayments(purchase.id),
                  reloadPurchaseData()
                ]);
              } else {
                await reloadPurchaseData();
              }
              
              setDeleteConfirmationOpen(false);
              setPaymentToDelete(null);
            } catch (error: any) {
              console.error('[VIEW PURCHASE] Error deleting payment:', error);
              toast.error(error?.message || 'Failed to delete payment. Please try again.');
            } finally {
              setIsDeletingPayment(false);
            }
          }}
          paymentAmount={paymentToDelete.amount}
          paymentMethod={paymentToDelete.method}
          paymentDate={paymentToDelete.date}
          referenceNumber={paymentToDelete.referenceNo}
          isLoading={isDeletingPayment}
        />
      )}

      {/* Edit Payment Dialog */}
      {paymentToEdit && purchase && (
        <UnifiedPaymentDialog
          isOpen={editPaymentDialogOpen}
          onClose={() => {
            setEditPaymentDialogOpen(false);
            setPaymentToEdit(null);
          }}
          context="supplier"
          entityName={purchase.supplierName || 'Supplier'}
          entityId={purchase.supplier}
          outstandingAmount={purchase.due}
          totalAmount={purchase.total}
          paidAmount={purchase.paid}
          referenceNo={purchase.purchaseNo}
          referenceId={purchase.id}
          editMode={true}
          paymentToEdit={{
            id: paymentToEdit.id,
            amount: paymentToEdit.amount,
            method: paymentToEdit.method,
            accountId: paymentToEdit.accountId || paymentToEdit.payment_account_id,
            date: paymentToEdit.date || paymentToEdit.payment_date,
            referenceNumber: paymentToEdit.referenceNo || paymentToEdit.reference_number,
            notes: paymentToEdit.notes,
            attachments: paymentToEdit.attachments,
          }}
          onSuccess={async () => {
            toast.success('Payment updated successfully');
            
            // Use purchase.id (database UUID) for payment operations
            const promises: Promise<any>[] = [reloadPurchaseData()];
            if (purchase?.id) {
              promises.push(loadPayments(purchase.id));
            }
            
            await Promise.all(promises);
            
            setEditPaymentDialogOpen(false);
            setPaymentToEdit(null);
          }}
        />
      )}
      
      {/* 🔒 CLONE FROM SALE PAGE: ViewPaymentsModal for payment history */}
      {purchase && (
        <ViewPaymentsModal
          isOpen={viewPaymentsModalOpen}
          onClose={() => {
            setViewPaymentsModalOpen(false);
          }}
          invoice={{
            id: purchase.id,
            invoiceNo: purchase.purchaseNo,
            date: purchase.date,
            customerName: purchase.supplierName || purchase.supplier,
            customerId: purchase.supplierId || purchase.supplier,
            total: purchase.total,
            paid: purchase.paid,
            due: purchase.due,
            paymentStatus: purchase.paymentStatus,
            referenceType: 'purchase', // 🔒 UUID ARCHITECTURE: Explicit entity type (no pattern matching)
          }}
          onAddPayment={() => {
            setViewPaymentsModalOpen(false);
            onAddPayment?.(purchase.id);
          }}
          onEditPayment={(payment) => {
            setViewPaymentsModalOpen(false);
            setPaymentToEdit(payment);
            setEditPaymentDialogOpen(true);
          }}
          onDeletePayment={async (paymentId: string) => {
            if (!purchase?.id || !paymentId) {
              throw new Error('Purchase or Payment ID not found');
            }
            try {
              await purchaseService.deletePayment(paymentId, purchase.id);
              await reloadPurchaseData();
              window.dispatchEvent(new CustomEvent('paymentAdded'));
            } catch (error: any) {
              console.error('[VIEW PURCHASE] Error deleting payment:', error);
              throw new Error(error?.message || 'Failed to delete payment. Please try again.');
            }
          }}
          onRefresh={async () => {
            await reloadPurchaseData();
          }}
        />
      )}

      {/* Packing Entry Modal */}
      {/* Purchase Return Item Selection Dialog — same layout as Purchase View */}
      <PurchaseReturnItemSelectionDialog
        open={itemSelectionDialogOpen}
        onOpenChange={setItemSelectionDialogOpen}
        purchase={purchase ? { id: purchase.id, items: purchase.items } : null}
        alreadyReturnedMap={alreadyReturnedMap}
        onSave={(selected) => {
          const newQuantities: Record<string, number> = {};
          const newPacking: Record<string, any> = {};
          purchase?.items.forEach((item) => {
            const key = `${item.productId}_${item.variationId || 'null'}`;
            newQuantities[key] = 0;
          });
          selected.forEach((item) => {
            const key = `${item.product_id}_${item.variation_id || 'null'}`;
            newQuantities[key] = item.return_qty;
            if (item.return_packing_details) newPacking[key] = item.return_packing_details;
          });
          setReturnQuantities(newQuantities);
          setReturnPackingDetails(newPacking);
          setItemSelectionDialogOpen(false);
        }}
      />

      {activePackingItem && (
        <PackingEntryModal
          open={packingModalOpen}
          onOpenChange={(open) => {
            setPackingModalOpen(open);
            if (!open) {
              setActivePackingItem(null);
            }
          }}
          productName={activePackingItem.productName || 'Product'}
          initialData={activePackingItem.packing_details || activePackingItem.packingDetails || undefined}
          returnMode={returnMode}
          returnPackingDetails={(() => {
            if (!returnMode || !activePackingItem) return undefined;
            const itemKey = `${activePackingItem.productId}_${activePackingItem.variationId || 'null'}`;
            return returnPackingDetails[itemKey];
          })()}
          onSaveReturnPacking={(() => {
            if (!returnMode || !activePackingItem) return undefined;
            const itemKey = `${activePackingItem.productId}_${activePackingItem.variationId || 'null'}`;
            return (details: any) => handleSaveReturnPacking(itemKey, details);
          })()}
          alreadyReturnedPieces={(() => {
            if (!returnMode || !activePackingItem) return new Set();
            const itemKey = `${activePackingItem.productId}_${activePackingItem.variationId || 'null'}`;
            return alreadyReturnedPiecesMap[itemKey] || new Set();
          })()}
          onSave={(details) => {
            // Normal mode: this could update the item if needed
            setPackingModalOpen(false);
            setActivePackingItem(null);
          }}
        />
      )}

      {/* Attachments viewer - Shared Component */}
      {attachmentsDialogList && (
        <AttachmentViewer
          attachments={attachmentsDialogList}
          isOpen={!!attachmentsDialogList}
          onClose={() => setAttachmentsDialogList(null)}
        />
      )}

    </>
  );
};
