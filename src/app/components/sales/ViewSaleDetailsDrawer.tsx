import React, { useState, useEffect, useCallback } from 'react';
import { useSales, Sale, convertFromSupabaseSale } from '@/app/context/SalesContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useSettings } from '@/app/context/SettingsContext';
import { branchService, Branch } from '@/app/services/branchService';
import { contactService } from '@/app/services/contactService';
import { saleService } from '@/app/services/saleService';
import { saleReturnService } from '@/app/services/saleReturnService';
import { activityLogService } from '@/app/services/activityLogService';
import { InvoicePrintLayout } from '../shared/InvoicePrintLayout';
import { PaymentDeleteConfirmationModal } from '../shared/PaymentDeleteConfirmationModal';
import { UnifiedPaymentDialog } from '../shared/UnifiedPaymentDialog';
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
  Paperclip,
  Image as ImageIcon,
  File,
  RotateCcw
} from 'lucide-react';
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { cn, formatBoxesPieces } from "../ui/utils";
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { toast } from 'sonner';
import { getAttachmentOpenUrl } from '@/app/utils/paymentAttachmentUrl';
import { getEffectiveSaleStatus, getSaleStatusBadgeConfig, canAddPaymentToSale } from '@/app/utils/statusHelpers';
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

interface SaleItem {
  id: number;
  productId: number;
  name: string;
  sku: string;
  price: number;
  qty: number;
  size?: string;
  color?: string;
  thaans?: number;
  meters?: number;
  packingDetails?: { total_boxes?: number; total_pieces?: number; total_meters?: number; [k: string]: unknown };
  unit?: string;
  stock?: number;
}

interface Payment {
  id: number;
  date: string;
  amount: number;
  method: string;
  reference?: string;
  note?: string;
}

interface SaleDetails {
  id: number;
  invoiceNo: string;
  date: string;
  customer: string;
  customerName: string;
  contactNumber: string;
  address?: string;
  location: string;
  salesman?: string;
  items: SaleItem[];
  subtotal: number;
  discount?: number;
  tax?: number;
  shippingCharges?: number;
  otherCharges?: number;
  total: number;
  paid: number;
  due: number;
  returnDue?: number;
  paymentStatus: 'Paid' | 'Partial' | 'Unpaid';
  shippingStatus: 'Pending' | 'Processing' | 'Shipped' | 'Delivered';
  status: 'Draft' | 'Quotation' | 'Order' | 'Final';
  payments: Payment[];
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

interface ViewSaleDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  saleId: string | null; // Changed to string (UUID)
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onAddPayment?: (id: string) => void;
  onPrint?: (id: string) => void;
}

export const ViewSaleDetailsDrawer: React.FC<ViewSaleDetailsDrawerProps> = ({
  isOpen,
  onClose,
  saleId,
  onEdit,
  onDelete,
  onAddPayment,
  onPrint,
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'payments' | 'history'>('details');
  const { getSaleById } = useSales();
  const { companyId, user } = useSupabase();
  const { inventorySettings } = useSettings();
  const { formatCurrency } = useFormatCurrency();
  const enablePacking = inventorySettings.enablePacking;
  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPrintLayout, setShowPrintLayout] = useState(false);
  const [branchMap, setBranchMap] = useState<Map<string, string>>(new Map());
  const [customerCode, setCustomerCode] = useState<string | null>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [loadingActivityLogs, setLoadingActivityLogs] = useState(false);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<any | null>(null);
  const [isDeletingPayment, setIsDeletingPayment] = useState(false);
  const [editPaymentDialogOpen, setEditPaymentDialogOpen] = useState(false);
  const [paymentToEdit, setPaymentToEdit] = useState<any | null>(null);
  const [attachmentsDialogList, setAttachmentsDialogList] = useState<{ url: string; name: string }[] | null>(null);
  const [saleReturns, setSaleReturns] = useState<any[]>([]);
  const [loadingSaleReturns, setLoadingSaleReturns] = useState(false);

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
        console.error('[VIEW SALE DETAILS] Error loading branches:', error);
      }
    };
    loadBranches();
  }, [companyId]);

  // Load sale data from context (TASK 2 & 3 FIX - Real data instead of mock)
  useEffect(() => {
    if (isOpen && saleId) {
      const loadSaleData = async () => {
        setLoading(true);
        try {
          // CRITICAL FIX: Fetch fresh sale data from database (not just context)
          const saleData = await saleService.getSaleById(saleId);
          if (saleData) {
            const convertedSale = convertFromSupabaseSale(saleData);
            // Preserve variation and packing from raw sale data (same as Purchase View: data from API)
            if (saleData.items && convertedSale.items) {
              const parsePacking = (v: any): any => {
                if (v == null) return v;
                if (typeof v === 'string') {
                  try { return JSON.parse(v); } catch { return null; }
                }
                return v;
              };
              convertedSale.items = convertedSale.items.map((item, idx) => {
                const rawItem = saleData.items[idx];
                if (rawItem) {
                  const rawPacking = parsePacking(rawItem.packing_details);
                  const packingDetails = rawPacking
                    ? { ...rawPacking, total_boxes: rawPacking.total_boxes ?? 0, total_pieces: rawPacking.total_pieces ?? 0, total_meters: rawPacking.total_meters ?? rawItem.packing_quantity ?? 0 }
                    : item.packingDetails;
                  return {
                    ...item,
                    variation: rawItem.variation || rawItem.product_variations || null,
                    packing_details: rawPacking ?? item.packing_details ?? undefined,
                    packingDetails: packingDetails ?? item.packingDetails ?? undefined,
                  } as any;
                }
                return item;
              });
            }
            // CRITICAL FIX: Ensure attachments are preserved
            if (saleData.attachments) {
              convertedSale.attachments = saleData.attachments;
            }
            setSale(convertedSale);
            
            // CRITICAL FIX: Load customer code if customer ID exists (not UUID display)
            if (convertedSale.customer && companyId) {
              contactService.getContact(convertedSale.customer)
                .then(contact => {
                  if (contact && (contact as any).code) {
                    setCustomerCode((contact as any).code);
                  } else {
                    setCustomerCode(null);
                  }
                })
                .catch(error => {
                  console.error('[VIEW SALE] Error loading customer:', error);
                  setCustomerCode(null);
                });
            } else {
              setCustomerCode(null);
            }
            
            // CRITICAL FIX: Load payments breakdown
            loadPayments(saleId);
          } else {
            // Fallback to context
            const contextSale = getSaleById(saleId);
            if (contextSale) {
              setSale(contextSale);
              loadPayments(saleId);
            }
          }
        } catch (error: any) {
          console.error('[VIEW SALE] Error loading sale:', error?.message || error);
          // Fallback to context
          const contextSale = getSaleById(saleId);
          if (contextSale) {
            setSale(contextSale);
            loadPayments(saleId);
          } else {
            // If context also doesn't have it, show error
            console.error('[VIEW SALE] Sale not found in context either');
          }
        } finally {
          setLoading(false);
        }
      };
      
      loadSaleData();
    } else {
      setLoading(false);
    }
  }, [isOpen, saleId, getSaleById, companyId]);
  
  // CRITICAL FIX: Load payments breakdown
  const loadPayments = useCallback(async (saleId: string) => {
    setLoadingPayments(true);
    try {
      const fetchedPayments = await saleService.getSalePayments(saleId);
      setPayments(fetchedPayments);
    } catch (error) {
      console.error('[VIEW SALE] Error loading payments:', error);
      setPayments([]);
    } finally {
      setLoadingPayments(false);
    }
  }, []);

  // CRITICAL FIX: Load activity logs
  const loadActivityLogs = useCallback(async (saleId: string) => {
    if (!companyId) return;
    setLoadingActivityLogs(true);
    try {
      const logs = await activityLogService.getEntityActivityLogs(companyId, 'sale', saleId);
      setActivityLogs(logs);
    } catch (error) {
      console.error('[VIEW SALE] Error loading activity logs:', error);
      setActivityLogs([]);
    } finally {
      setLoadingActivityLogs(false);
    }
  }, [companyId]);
  
  // CRITICAL FIX: Reload sale data (called after payment is added)
  const reloadSaleData = useCallback(async () => {
    if (!saleId) return;
    try {
      const saleData = await saleService.getSaleById(saleId);
      if (saleData) {
        const convertedSale = convertFromSupabaseSale(saleData);
        setSale(convertedSale);
        // Reload payments
        await loadPayments(saleId);
      }
    } catch (error: any) {
      console.error('[VIEW SALE] Error reloading sale:', error?.message || error);
    }
  }, [saleId, loadPayments]);
  
  // CRITICAL FIX: Listen for payment added event
  useEffect(() => {
    const handlePaymentAdded = () => {
      if (saleId) {
        reloadSaleData();
      }
    };
    
    window.addEventListener('paymentAdded', handlePaymentAdded);
    return () => {
      window.removeEventListener('paymentAdded', handlePaymentAdded);
    };
  }, [saleId, reloadSaleData]);

  // Load sale returns for this sale when final (so effective status can show Returned/Partially Returned)
  useEffect(() => {
    if (!companyId || !saleId || !sale) return;
    const isFinal = (sale.status || '').toString().toLowerCase() === 'final';
    if (!isFinal) {
      setSaleReturns([]);
      return;
    }
    setLoadingSaleReturns(true);
    saleReturnService.getSaleReturns(companyId, undefined)
      .then((list) => {
        const forThisSale = (list || []).filter((r: any) => r.original_sale_id === saleId);
        setSaleReturns(forThisSale);
        if (forThisSale.length > 0) {
          setSale((prev) => {
            if (!prev) return null;
            const count = forThisSale.length;
            if ((prev as any).hasReturn && (prev as any).returnCount === count) return prev;
            return { ...prev, hasReturn: true, returnCount: count } as Sale;
          });
        }
      })
      .catch(() => setSaleReturns([]))
      .finally(() => setLoadingSaleReturns(false));
  }, [companyId, saleId, sale?.id, (sale as any)?.status]);

  if (!isOpen || !saleId) return null;

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
        <div className="text-white">Loading sale details...</div>
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
        <div className="text-white">Sale not found</div>
        <Button onClick={onClose} className="ml-4">Close</Button>
      </div>
    );
  }

  const effectiveStatus = getEffectiveSaleStatus(sale);
  const isCancelled = effectiveStatus === 'cancelled';
  const isReturned = effectiveStatus === 'returned';
  const isPartiallyReturned = effectiveStatus === 'partially_returned';
  const statusBadgeConfig = getSaleStatusBadgeConfig(sale);
  const badge = statusBadgeConfig?.bg != null ? statusBadgeConfig : { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30', label: 'Draft' };
  const canAddPayment = canAddPaymentToSale(sale, sale.due ?? 0);

  const getStatusColor = (status: string) => {
    const s = (status || '').toLowerCase();
    switch (s) {
      case 'final': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'order': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'quotation': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'draft': return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
      case 'cancelled': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'returned': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'partially_returned': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'Paid': return 'bg-green-500/10 text-green-500';
      case 'Partial': return 'bg-yellow-500/10 text-yellow-500';
      case 'Unpaid': return 'bg-red-500/10 text-red-500';
      default: return 'bg-gray-500/10 text-gray-500';
    }
  };

  const getShippingStatusColor = (status: string) => {
    switch (status) {
      case 'Delivered': return 'bg-green-500/10 text-green-500';
      case 'Shipped': return 'bg-blue-500/10 text-blue-500';
      case 'Processing': return 'bg-yellow-500/10 text-yellow-500';
      case 'Pending': return 'bg-gray-500/10 text-gray-500';
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
        {/* Cancelled banner - top of drawer when sale is cancelled */}
        {isCancelled && (
          <div className="shrink-0 bg-amber-500/20 border-b border-amber-500/30 px-6 py-3 flex items-center gap-2">
            <X size={18} className="text-amber-500" />
            <span className="font-semibold text-amber-200 uppercase tracking-wide">Cancelled Invoice</span>
            <span className="text-amber-300/90 text-sm">Reversed entry created.</span>
          </div>
        )}
        {/* Header */}
        <div className="bg-gray-900/80 border-b border-gray-800 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-3">
                {sale.invoiceNo}
                <Badge className={cn("text-xs font-semibold border", badge.bg, badge.text, badge.border)}>
                  {badge.label}
                </Badge>
              </h2>
              <p className="text-sm text-gray-400 mt-0.5">
                Sale Transaction Details
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
                onPrint?.(sale.id);
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
                    onClick={() => onEdit?.(sale.id)}
                  >
                    <Edit size={14} className="mr-2" />
                    Edit Sale
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
                {!isCancelled && (
                  <DropdownMenuItem 
                    className="hover:bg-gray-800 cursor-pointer text-red-400"
                    onClick={() => onDelete?.(sale.id)}
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
              {/* Customer & Transaction Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Customer Info */}
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4 flex items-center gap-2">
                    <User size={16} />
                    Customer Information
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Customer Name</p>
                      <p className="text-white font-medium">{sale.customerName}</p>
                      {customerCode && (
                        <p className="text-sm text-gray-400">Code: {customerCode}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Contact Number</p>
                      <p className="text-white flex items-center gap-2">
                        <Phone size={14} className="text-gray-500" />
                        {sale.contactNumber}
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
                          <div>{new Date(sale.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {new Date(sale.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">Location</span>
                      <span className="text-white flex items-center gap-2">
                        <Building2 size={14} className="text-gray-500" />
                        {branchMap.get(sale.location) || sale.location}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">Created At</span>
                      <span className="text-white">{new Date(sale.createdAt).toLocaleString()}</span>
                    </div>
                    {sale.updatedAt && (
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-500">Last Updated</span>
                        <span className="text-white">{new Date(sale.updatedAt).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Status Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-2">Payment Status</p>
                  <Badge className={cn("text-sm font-semibold", getPaymentStatusColor(sale.paymentStatus === 'paid' ? 'Paid' : sale.paymentStatus === 'partial' ? 'Partial' : 'Unpaid'))}>
                    {sale.paymentStatus === 'paid' ? 'Paid' : sale.paymentStatus === 'partial' ? 'Partial' : 'Unpaid'}
                  </Badge>
                </div>
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-2">Shipping Status</p>
                  <Badge className={cn("text-sm font-semibold", getShippingStatusColor(sale.shippingStatus === 'delivered' ? 'Delivered' : sale.shippingStatus === 'processing' ? 'Processing' : sale.shippingStatus === 'cancelled' ? 'Cancelled' : 'Pending'))}>
                    <Truck size={14} className="mr-1" />
                    {sale.shippingStatus === 'delivered' ? 'Delivered' : sale.shippingStatus === 'processing' ? 'Processing' : sale.shippingStatus === 'cancelled' ? 'Cancelled' : 'Pending'}
                  </Badge>
                </div>
              </div>

              {/* Sale Returns - when this sale has returns */}
              {((sale as any).hasReturn || (sale as any).returnCount > 0 || saleReturns.length > 0) && (
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
                  <div className="px-5 py-3 bg-gray-950/50 border-b border-gray-800 flex items-center gap-2">
                    <RotateCcw size={16} className="text-purple-400" />
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Sale Returns</h3>
                    {loadingSaleReturns && <span className="text-xs text-gray-500">Loading...</span>}
                  </div>
                  <div className="p-4">
                    {loadingSaleReturns ? (
                      <p className="text-sm text-gray-500">Loading returns...</p>
                    ) : saleReturns.length === 0 ? (
                      <p className="text-sm text-gray-500">No returns found for this sale.</p>
                    ) : (
                      <ul className="space-y-2">
                        {saleReturns.map((ret: any) => {
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

              {/* Items Table — same structure as ViewPurchaseDetailsDrawer (UI + data from API) */}
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
                <div className="px-5 py-3 bg-gray-950/50 border-b border-gray-800 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-2">
                    <Package size={16} />
                    Items ({sale.items.length})
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
                      {sale.items.map((item) => {
                        const productName = item.productName || item.name || 'Unknown Product';
                        const displaySku = item.sku || 'N/A';
                        const qty = item.quantity ?? (item as any).qty ?? 0;
                        const variation = (item as any).variation || (item as any).product_variations || null;
                        const variationAttrs = variation?.attributes || {};
                        const variationSku = variation?.sku || null;
                        const variationText = variationAttrs
                          ? Object.entries(variationAttrs)
                              .filter(([_, v]) => v != null && v !== '')
                              .map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)}: ${v}`)
                              .join(', ')
                          : null;
                        // Packing: same as Purchase View — from item.packing_details || item.packingDetails (parse if JSON string)
                        const rawPd = (item as any).packing_details ?? item.packingDetails;
                        const pd = (() => {
                          if (rawPd == null) return {};
                          if (typeof rawPd === 'string') {
                            try { return JSON.parse(rawPd) || {}; } catch { return {}; }
                          }
                          return rawPd;
                        })();
                        const totalBoxes = pd.total_boxes ?? 0;
                        const totalPieces = pd.total_pieces ?? 0;
                        const totalMeters = pd.total_meters ?? 0;
                        const packingParts: string[] = [];
                        if (Number(totalBoxes) > 0) packingParts.push(`${formatBoxesPieces(totalBoxes)} Box${Math.round(Number(totalBoxes)) !== 1 ? 'es' : ''}`);
                        if (Number(totalPieces) > 0) packingParts.push(`${formatBoxesPieces(totalPieces)} Piece${Math.round(Number(totalPieces)) !== 1 ? 's' : ''}`);
                        if (Number(totalMeters) > 0) packingParts.push(`${Number(totalMeters).toFixed(2)} M`);
                        const packingText = packingParts.length
                          ? packingParts.join(', ')
                          : (item.thaans != null || item.meters != null)
                            ? [item.thaans != null && item.thaans > 0 ? `${item.thaans} Thaan${item.thaans !== 1 ? 's' : ''}` : null, item.meters != null && item.meters > 0 ? `${item.meters}m` : null].filter(Boolean).join(' · ') || '—'
                            : '—';
                        const unitDisplay = item.unit ?? 'piece';
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
                            {enablePacking && (
                              <TableCell className="text-gray-400">
                                <span>{packingText}</span>
                              </TableCell>
                            )}
                            <TableCell className="text-right text-white">
{formatCurrency(Number(item.price || 0))}
                            </TableCell>
                            <TableCell className="text-center text-white font-medium">
                              {qty}
                            </TableCell>
                            <TableCell className="text-gray-400">{unitDisplay}</TableCell>
                            <TableCell className="text-right text-white font-medium">
{formatCurrency(Number(item.price || 0) * qty)}
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
                    <span className="text-white font-medium">{formatCurrency(sale.subtotal)}</span>
                  </div>
                  
                  {sale.discount && sale.discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Discount</span>
                      <span className="text-red-400 font-medium">- {formatCurrency(sale.discount)}</span>
                    </div>
                  )}
                  
                  {sale.tax && sale.tax > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Tax</span>
                      <span className="text-white font-medium">{formatCurrency(sale.tax)}</span>
                    </div>
                  )}
                  
                  {/* CRITICAL FIX: Show shipping charges clearly */}
                  {(sale.shippingCharges && sale.shippingCharges > 0) || (sale.expenses && sale.expenses > 0) ? (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Shipping Charges</span>
                      <span className="text-white font-medium">
{formatCurrency(sale.shippingCharges || sale.expenses || 0)}
                      </span>
                    </div>
                  ) : null}
                  
                  {/* CRITICAL FIX: Show extra/other charges clearly */}
                  {sale.otherCharges && sale.otherCharges > 0 ? (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Extra Charges</span>
                      <span className="text-white font-medium">{formatCurrency(sale.otherCharges)}</span>
                    </div>
                  ) : null}
                  
                  {/* CRITICAL FIX: Show expenses if different from shipping */}
                  {sale.expenses && sale.expenses > 0 && sale.expenses !== (sale.shippingCharges || 0) ? (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Other Expenses</span>
                      <span className="text-white font-medium">{formatCurrency(sale.expenses)}</span>
                    </div>
                  ) : null}
                  
                  <Separator className="bg-gray-800" />
                  
                  <div className="flex justify-between">
                    <span className="text-gray-300 font-semibold">Grand Total</span>
                    <span className="text-white text-xl font-bold">{formatCurrency(sale.total)}</span>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Total Paid</span>
                    <span className="text-green-400 font-medium">{formatCurrency(sale.paid)}</span>
                  </div>
                  
                  {sale.due > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-400 font-medium">Amount Due</span>
                      <span className="text-red-400 text-lg font-bold">{formatCurrency(sale.due)}</span>
                    </div>
                  )}
                  
                  {sale.returnDue && sale.returnDue > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Return Due</span>
                      <span className="text-yellow-400 font-medium">{formatCurrency(sale.returnDue)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              {sale.notes && (
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Notes</h3>
                  <p className="text-white text-sm leading-relaxed">{sale.notes}</p>
                </div>
              )}

              {/* Attachments */}
              {(() => {
                const hasAttachments = sale.attachments && (
                  Array.isArray(sale.attachments) 
                    ? sale.attachments.length > 0 
                    : !!sale.attachments
                );
                
                if (!hasAttachments) {
                  return null;
                }
                
                
                return (
                  <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <Paperclip size={16} />
                      Attachments ({Array.isArray(sale.attachments) ? sale.attachments.length : 1})
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {Array.isArray(sale.attachments) ? (
                        sale.attachments.map((att: any, idx: number) => {
                          const url = typeof att === 'string' ? att : (att?.url || att?.fileUrl || '');
                          const name = typeof att === 'object' && att?.name ? att.name : (typeof att === 'object' && (att?.fileName || att?.file_name) ? (att.fileName || att.file_name) : `Attachment ${idx + 1}`);
                          if (!url) {
                            console.warn('[VIEW SALE] Attachment missing URL:', att);
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
                      ) : typeof sale.attachments === 'string' ? (
                        <button
                          type="button"
                          onClick={async () => {
                            const openUrl = await getAttachmentOpenUrl(sale.attachments as string);
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
              {/* Add Payment Button - hidden when cancelled/returned; shown for final or partially_returned with due */}
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-white">Payment History</h3>
                {canAddPayment && (
                  <Button
                    onClick={() => {
                      onAddPayment?.(sale.id);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <CreditCard size={16} className="mr-2" />
                    Add Payment
                  </Button>
                )}
              </div>

              {/* CRITICAL FIX: Payment Summary with Cash/Bank Breakdown */}
              {loadingPayments ? (
                <div className="text-center py-12 text-gray-400">Loading payments...</div>
              ) : payments.length > 0 ? (
                <div className="space-y-4">
                  {/* Summary Cards by Payment Method */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Cash Payments Summary */}
                    {payments.filter(p => p.method === 'cash').length > 0 && (
                      <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                        <p className="text-xs text-gray-400 mb-1">Paid (Cash)</p>
                        <p className="text-2xl font-bold text-green-400">
{formatCurrency(payments.filter(p => p.method === 'cash').reduce((sum, p) => sum + p.amount, 0))}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {payments.filter(p => p.method === 'cash').length} payment(s)
                        </p>
                      </div>
                    )}
                    
                    {/* Bank Payments Summary */}
                    {payments.filter(p => p.method === 'bank' || p.method === 'card').length > 0 && (
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                        <p className="text-xs text-gray-400 mb-1">Paid (Bank/Card)</p>
                        <p className="text-2xl font-bold text-blue-400">
{formatCurrency(payments.filter(p => p.method === 'bank' || p.method === 'card').reduce((sum, p) => sum + p.amount, 0))}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {payments.filter(p => p.method === 'bank' || p.method === 'card').length} payment(s)
                        </p>
                      </div>
                    )}
                    
                    {/* Other Payments Summary */}
                    {payments.filter(p => p.method === 'other' || (p.method !== 'cash' && p.method !== 'bank' && p.method !== 'card')).length > 0 && (
                      <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
                        <p className="text-xs text-gray-400 mb-1">Paid (Other)</p>
                        <p className="text-2xl font-bold text-purple-400">
{formatCurrency(payments.filter(p => p.method === 'other' || (p.method !== 'cash' && p.method !== 'bank' && p.method !== 'card')).reduce((sum, p) => sum + p.amount, 0))}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {payments.filter(p => p.method === 'other' || (p.method !== 'cash' && p.method !== 'bank' && p.method !== 'card')).length} payment(s)
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {/* Total Paid Summary */}
                  <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <p className="text-white font-semibold text-xl">
{formatCurrency(sale.paid)}
                        </p>
                        <p className="text-sm text-gray-400 mt-1">
                          Total Paid Amount
                        </p>
                      </div>
                      <Badge className={cn(
                        "text-sm font-semibold",
                        sale.paymentStatus === 'paid' ? "bg-green-500/10 text-green-400 border-green-500/20" :
                        sale.paymentStatus === 'partial' ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
                        "bg-red-500/10 text-red-400 border-red-500/20"
                      )}>
                        {sale.paymentStatus === 'paid' ? 'Paid' : sale.paymentStatus === 'partial' ? 'Partial' : 'Unpaid'}
                      </Badge>
                    </div>
                    
{sale.due > 0 && canAddPayment && (
                    <div className="flex justify-between text-sm pt-3 border-t border-gray-800">
                        <span className="text-gray-400">Amount Due:</span>
                        <span className="text-red-400 font-medium">
{formatCurrency(sale.due)}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Individual Payment Breakdown */}
                <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-gray-400 uppercase">Payment Details</h4>
                    {payments.map((payment) => (
                    <div 
                      key={payment.id}
                        className="bg-gray-900/50 border border-gray-800 rounded-xl p-4"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-white font-semibold">
{formatCurrency(payment.amount)}
                          </p>
                              {payment.referenceNo && (
                                <code className="text-xs bg-gray-800 px-2 py-0.5 rounded text-blue-400 border border-gray-700">
                                  {payment.referenceNo}
                                </code>
                              )}
                            </div>
                            <p className="text-sm text-gray-400">
                            {new Date(payment.date).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric', 
                                year: 'numeric'
                            })}
                          </p>
                            {payment.accountName && (
                              <p className="text-xs text-gray-500 mt-1">
                                Account: {payment.accountName}
                              </p>
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
                              {payment.method === 'cash' ? 'Cash' : 
                               payment.method === 'bank' ? 'Bank' :
                               payment.method === 'card' ? 'Card' : 'Other'}
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
                        {/* Note: shown above; attachments section below */}
                        {(payment.attachments && (Array.isArray(payment.attachments) ? payment.attachments.length > 0 : !!payment.attachments)) && (
                          <div className="mt-3 pt-3 border-t border-gray-800 flex flex-wrap items-center gap-2">
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Paperclip size={12} /> Attachments:
                            </span>
                            {Array.isArray(payment.attachments) ? (
                              payment.attachments.map((att: any, idx: number) => {
                                const url = typeof att === 'string' ? att : (att?.url || att?.fileUrl || att?.href);
                                const name = typeof att === 'object' && att?.name ? att.name : (typeof att === 'object' && (att?.fileName || att?.file_name)) ? (att.fileName || att.file_name) : `Attachment ${idx + 1}`;
                                if (!url) return null;
                                const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(String(url));
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
                                    {isImage ? <ImageIcon size={14} /> : <File size={14} />}
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
              ) : sale.paid > 0 ? (
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
                  <p className="text-white font-semibold text-lg">
{formatCurrency(sale.paid)}
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    Total paid amount (payment details loading...)
                  </p>
                </div>
              ) : (
                <div className="text-center py-12">
                  <CreditCard size={48} className="mx-auto text-gray-700 mb-4" />
                  <p className="text-gray-500">No payments recorded yet</p>
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

        {/* Footer Actions - Add Payment when allowed by effective status (final/partially_returned with due) */}
{activeTab === 'details' && canAddPayment && (
          <div className="border-t border-gray-800 px-6 py-4 bg-gray-900/50 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Amount Due</p>
                <p className="text-2xl font-bold text-red-400">{formatCurrency(sale.due)}</p>
              </div>
          <Button
                onClick={() => onAddPayment?.(sale.id)}
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
      {showPrintLayout && sale && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
            <InvoicePrintLayout 
              sale={sale} 
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
            if (!paymentToDelete || !sale || !companyId) return;
            
            setIsDeletingPayment(true);
            try {
              const deletePromise = saleService.deletePayment(paymentToDelete.id, sale.id);
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
                    entityId: sale.id,
                    entityReference: sale.invoiceNo,
                    action: 'payment_deleted',
                    amount: paymentToDelete.amount,
                    paymentMethod: paymentToDelete.method,
                    performedBy: user?.id || undefined,
                    description: `Payment of ${formatCurrency(paymentToDelete.amount)} deleted from sale ${sale.invoiceNo}`,
                  });
                } catch (logError) {
                  console.error('[VIEW SALE] Error logging payment deletion:', logError);
                }
              }
              
              toast.success('Payment deleted successfully. Reverse entry created.');
              
              await Promise.all([
                loadPayments(sale.id),
                reloadSaleData()
              ]);
              
              setDeleteConfirmationOpen(false);
              setPaymentToDelete(null);
            } catch (error: any) {
              console.error('[VIEW SALE] Error deleting payment:', error);
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
      {paymentToEdit && sale && (
        <UnifiedPaymentDialog
          isOpen={editPaymentDialogOpen}
          onClose={() => {
            setEditPaymentDialogOpen(false);
            setPaymentToEdit(null);
          }}
          context="customer"
          entityName={sale.customerName || 'Customer'}
          entityId={sale.customer}
          outstandingAmount={sale.due}
          totalAmount={sale.total}
          paidAmount={sale.paid}
          referenceNo={sale.invoiceNo}
          referenceId={sale.id}
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
            await Promise.all([
              loadPayments(sale.id),
              reloadSaleData()
            ]);
            setEditPaymentDialogOpen(false);
            setPaymentToEdit(null);
            if (sale.customer) {
              window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'customer', entityId: sale.customer } }));
            }
          }}
        />
      )}

      {/* Attachments dialog: list attachments, open in new tab from here */}
      <Dialog open={!!attachmentsDialogList} onOpenChange={(open) => !open && setAttachmentsDialogList(null)}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Paperclip size={20} className="text-amber-400" />
              Attachments
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {attachmentsDialogList?.map((att, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-2 p-2 rounded-lg bg-gray-800/50 border border-gray-700"
              >
                <span className="text-sm text-gray-200 truncate flex-1" title={att.name}>{att.name}</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
                  onClick={async () => {
                    const openUrl = await getAttachmentOpenUrl(att.url);
                    window.open(openUrl, '_blank');
                  }}
                >
                  Open in new tab
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
