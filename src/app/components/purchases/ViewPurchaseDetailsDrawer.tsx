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
  File
} from 'lucide-react';
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { cn } from "../ui/utils";
import { toast } from 'sonner';
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
import { AttachmentViewer } from '@/app/components/shared/AttachmentViewer';

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
  purchaseId: string | null; // Changed to string (UUID)
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onAddPayment?: (id: string) => void;
  onPrint?: (id: string) => void;
}

export const ViewPurchaseDetailsDrawer: React.FC<ViewPurchaseDetailsDrawerProps> = ({
  isOpen,
  onClose,
  purchaseId,
  onEdit,
  onDelete,
  onAddPayment,
  onPrint,
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'payments' | 'history'>('details');
  const { getPurchaseById } = usePurchases();
  const { companyId, user } = useSupabase();
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
      console.log('[VIEW PURCHASE] Loading payments for purchaseId:', purchaseId);
      const fetchedPayments = await purchaseService.getPurchasePayments(purchaseId);
      console.log('[VIEW PURCHASE] Loaded payments:', fetchedPayments);
      console.log('[VIEW PURCHASE] Payment count:', fetchedPayments?.length || 0);
      if (fetchedPayments && fetchedPayments.length > 0) {
        console.log('[VIEW PURCHASE] First payment sample:', fetchedPayments[0]);
      }
      setPayments(fetchedPayments || []);
    } catch (error) {
      console.error('[VIEW PURCHASE] Error loading payments:', error);
      setPayments([]);
    } finally {
      setLoadingPayments(false);
    }
  }, []);

  // Load purchase data from context (TASK 2 & 3 FIX - Real data instead of mock)
  useEffect(() => {
    if (isOpen && purchaseId) {
      const loadPurchaseData = async () => {
        setLoading(true);
        try {
          console.log('[VIEW PURCHASE] Loading purchase data for purchaseId:', purchaseId);
          // CRITICAL FIX: Fetch fresh purchase data from database (not just context)
          const purchaseData = await purchaseService.getPurchase(purchaseId);
          if (purchaseData) {
            console.log('[VIEW PURCHASE] Purchase data loaded from database:', purchaseData.id);
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
            console.log('[VIEW PURCHASE] Purchase attachments:', convertedPurchase.attachments);
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
            
            // CRITICAL FIX: Load payments breakdown - use database ID
            console.log('[VIEW PURCHASE] Loading payments for purchase database ID:', purchaseData.id);
            await loadPayments(purchaseData.id);
          } else {
            // Fallback to context
            console.log('[VIEW PURCHASE] Purchase not found in database, trying context...');
            const contextPurchase = getPurchaseById(purchaseId);
            if (contextPurchase) {
              console.log('[VIEW PURCHASE] Found purchase in context, ID:', contextPurchase.id);
              setPurchase(contextPurchase);
              // Use context purchase ID (which should be the database UUID)
              await loadPayments(contextPurchase.id);
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
            // Use context purchase ID (which should be the database UUID)
            await loadPayments(contextPurchase.id);
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
  }, [isOpen, purchaseId, getPurchaseById, companyId, loadPayments]);

  // CRITICAL FIX: Load activity logs
  const loadActivityLogs = useCallback(async (purchaseId: string) => {
    if (!companyId) return;
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
  
  // CRITICAL FIX: Reload purchase data (called after payment is added)
  const reloadPurchaseData = useCallback(async () => {
    if (!purchaseId) return;
    try {
      const purchaseData = await purchaseService.getPurchase(purchaseId);
      if (purchaseData) {
        const convertedPurchase = convertFromSupabasePurchase(purchaseData);
        setPurchase(convertedPurchase);
        // Reload payments - use database ID
        await loadPayments(purchaseData.id);
      }
    } catch (error: any) {
      console.error('[VIEW PURCHASE] Error reloading purchase:', error?.message || error);
    }
  }, [purchaseId, loadPayments]);
  
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'final': 
      case 'completed': 
      case 'received': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'ordered': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'draft': return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
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
        {/* Header */}
        <div className="bg-gray-900/80 border-b border-gray-800 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-3">
                {purchase.purchaseNo}
                <Badge className={cn("text-xs font-semibold border", getStatusColor(purchase.status))}>
                  {purchase.status === 'final' || purchase.status === 'completed' ? 'Final' : 
                   purchase.status === 'received' ? 'Received' : 
                   purchase.status === 'ordered' ? 'Ordered' : 'Draft'}
                </Badge>
              </h2>
              <p className="text-sm text-gray-400 mt-0.5">
                Purchase Transaction Details
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
                <DropdownMenuItem 
                  className="hover:bg-gray-800 cursor-pointer"
                  onClick={() => onEdit?.(purchase.id)}
                >
                  <Edit size={14} className="mr-2" />
                  Edit Purchase
                </DropdownMenuItem>
                <DropdownMenuItem className="hover:bg-gray-800 cursor-pointer">
                  <Download size={14} className="mr-2" />
                  Export PDF
                </DropdownMenuItem>
                <DropdownMenuItem className="hover:bg-gray-800 cursor-pointer">
                  <Share2 size={14} className="mr-2" />
                  Share
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="hover:bg-gray-800 cursor-pointer text-red-400"
                  onClick={() => onDelete?.(purchase.id)}
                >
                  <Trash2 size={14} className="mr-2" />
                  Delete
                </DropdownMenuItem>
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
              {/* Supplier & Transaction Info */}
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
                          <div>{new Date(purchase.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {new Date(purchase.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
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
                      <span className="text-white">{new Date(purchase.createdAt).toLocaleString()}</span>
                    </div>
                    {purchase.updatedAt && (
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-500">Last Updated</span>
                        <span className="text-white">{new Date(purchase.updatedAt).toLocaleString()}</span>
                    </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Status Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-2">Payment Status</p>
                  <Badge className={cn("text-sm font-semibold", getPaymentStatusColor(purchase.paymentStatus))}>
                    {purchase.paymentStatus === 'paid' ? 'Paid' : purchase.paymentStatus === 'partial' ? 'Partial' : 'Unpaid'}
                  </Badge>
                </div>
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-2">Order Status</p>
                  <Badge className={cn("text-sm font-semibold", getStatusColor(purchase.status))}>
                    {purchase.status === 'final' || purchase.status === 'completed' ? 'Final' : 
                     purchase.status === 'received' ? 'Received' : 
                     purchase.status === 'ordered' ? 'Ordered' : 'Draft'}
                  </Badge>
                </div>
              </div>

              {/* Items Table */}
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
                <div className="px-5 py-3 bg-gray-950/50 border-b border-gray-800">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-2">
                    <Package size={16} />
                    Items ({purchase.items.length})
                  </h3>
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
                        <TableHead className="text-gray-400 text-center">Qty</TableHead>
                        <TableHead className="text-gray-400">Unit</TableHead>
                        <TableHead className="text-gray-400 text-right">Total</TableHead>
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
                        
                        // Packing: structured – Boxes + Pieces
                        const pd = item.packingDetails || {};
                        const totalBoxes = pd.total_boxes ?? 0;
                        const totalPieces = pd.total_pieces ?? 0;
                        const packingParts: string[] = [];
                        if (Number(totalBoxes) > 0) packingParts.push(`${totalBoxes} Box${Number(totalBoxes) !== 1 ? 'es' : ''}`);
                        if (Number(totalPieces) > 0) packingParts.push(`${totalPieces} Piece${Number(totalPieces) !== 1 ? 's' : ''}`);
                        const packingText = packingParts.length ? packingParts.join(', ') : '—';
                        const unitDisplay = item.unit ?? 'piece';
                        
                        // Use variation SKU if available, otherwise use product SKU
                        const finalSku = variationSku || displaySku;
                        
                        return (
                        <TableRow key={item.id} className="border-gray-800">
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
                          {enablePacking && <TableCell className="text-gray-400">{packingText}</TableCell>}
                          <TableCell className="text-right text-white">
                            Rs. {item.price.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-center text-white font-medium">
                            {qty}
                          </TableCell>
                          <TableCell className="text-gray-400">{unitDisplay}</TableCell>
                          <TableCell className="text-right text-white font-medium">
                            Rs. {(item.price * qty).toLocaleString()}
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  </div>
                </div>

              {/* Payment Summary */}
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
                    <span className="text-white font-medium">Rs. {purchase.subtotal.toLocaleString()}</span>
                  </div>
                  
                  {purchase.discount && purchase.discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Discount</span>
                      <span className="text-red-400 font-medium">- Rs. {purchase.discount.toLocaleString()}</span>
                    </div>
                  )}
                  
                  {purchase.tax && purchase.tax > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Tax</span>
                      <span className="text-white font-medium">Rs. {purchase.tax.toLocaleString()}</span>
                    </div>
                  )}
                  
                  {purchase.shippingCost && purchase.shippingCost > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Shipping Charges</span>
                      <span className="text-white font-medium">Rs. {purchase.shippingCost.toLocaleString()}</span>
                    </div>
                  )}
                  
                  <Separator className="bg-gray-800" />
                  
                  <div className="flex justify-between">
                    <span className="text-gray-300 font-semibold">Grand Total</span>
                    <span className="text-white text-xl font-bold">Rs. {purchase.total.toLocaleString()}</span>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Total Paid</span>
                    <span className="text-green-400 font-medium">Rs. {purchase.paid.toLocaleString()}</span>
                  </div>
                  
                  {purchase.due > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-400 font-medium">Amount Due</span>
                      <span className="text-red-400 text-lg font-bold">Rs. {purchase.due.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>

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
                  console.log('[VIEW PURCHASE] No attachments found:', {
                    attachments: purchase.attachments,
                    type: typeof purchase.attachments,
                    isArray: Array.isArray(purchase.attachments),
                  });
                  return null;
                }
                
                console.log('[VIEW PURCHASE] Rendering attachments:', purchase.attachments);
                
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
                {purchase.due > 0 && (
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
                          Rs. {payments.filter((p: any) => p.method === 'cash').reduce((sum: number, p: any) => sum + p.amount, 0).toLocaleString()}
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
                          Rs. {payments.filter((p: any) => p.method === 'bank' || p.method === 'card').reduce((sum: number, p: any) => sum + p.amount, 0).toLocaleString()}
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
                          Rs. {payments.filter((p: any) => p.method === 'other' || (p.method !== 'cash' && p.method !== 'bank' && p.method !== 'card')).reduce((sum: number, p: any) => sum + p.amount, 0).toLocaleString()}
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
                          Rs. {purchase.paid.toLocaleString()}
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
                        <span className="text-red-400 font-medium">Rs. {purchase.due.toLocaleString()}</span>
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
                              <p className="text-white font-semibold">Rs. {payment.amount.toLocaleString()}</p>
                              {payment.referenceNo && (
                                <code className="text-xs bg-gray-800 px-2 py-0.5 rounded text-blue-400 border border-gray-700">
                                  {payment.referenceNo}
                                </code>
                              )}
                            </div>
                            <p className="text-sm text-gray-400">
                              {new Date(payment.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
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
                  <p className="text-white font-semibold text-lg">Rs. {purchase.paid.toLocaleString()}</p>
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
                            {new Date(log.created_at).toLocaleString()}
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
                              Amount: Rs. {log.amount.toLocaleString()} {log.payment_method && `via ${log.payment_method}`}
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

        {/* Footer Actions */}
        {activeTab === 'details' && purchase.due > 0 && (
          <div className="border-t border-gray-800 px-6 py-4 bg-gray-900/50 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Amount Due</p>
                <p className="text-2xl font-bold text-red-400">Rs. {purchase.due.toLocaleString()}</p>
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
              
              // CRITICAL FIX: Log activity
              if (companyId) {
                try {
                  await activityLogService.logActivity({
                    companyId,
                    module: 'payment',
                    entityId: purchase.id,
                    entityReference: purchase.purchaseNo,
                    action: 'payment_deleted',
                    amount: paymentToDelete.amount,
                    paymentMethod: paymentToDelete.method,
                    performedBy: user?.id || undefined,
                    description: `Payment of Rs ${paymentToDelete.amount.toLocaleString()} deleted from purchase ${purchase.purchaseNo}`,
                  });
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
