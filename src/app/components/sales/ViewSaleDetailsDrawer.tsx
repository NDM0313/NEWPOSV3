import React, { useState, useEffect, useCallback } from 'react';
import { useSales, Sale, convertFromSupabaseSale } from '@/app/context/SalesContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useSettings } from '@/app/context/SettingsContext';
import { branchService, Branch } from '@/app/services/branchService';
import { contactService } from '@/app/services/contactService';
import { saleService } from '@/app/services/saleService';
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Final': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'Order': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'Quotation': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'Draft': return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
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
        {/* Header */}
        <div className="bg-gray-900/80 border-b border-gray-800 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-3">
                {sale.invoiceNo}
                <Badge className={cn("text-xs font-semibold border", getStatusColor(sale.type === 'invoice' ? 'Final' : 'Quotation'))}>
                  {sale.type === 'invoice' ? 'Final' : 'Quotation'}
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
                <DropdownMenuItem 
                  className="hover:bg-gray-800 cursor-pointer"
                  onClick={() => onEdit?.(sale.id)}
                >
                  <Edit size={14} className="mr-2" />
                  Edit Sale
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
                  onClick={() => onDelete?.(sale.id)}
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

              {/* Items Table */}
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
                <div className="px-5 py-3 bg-gray-950/50 border-b border-gray-800">
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
                        // CRITICAL FIX: Use productName from joined product data, fallback to item.name
                        const productName = item.productName || item.name || 'Unknown Product';
                        const displaySku = item.sku || 'N/A';
                        const qty = item.quantity ?? (item as any).qty ?? 0;
                        // Packing: structured – Boxes + Pieces (same contract as ledger)
                        const pd = item.packingDetails || {};
                        const totalBoxes = pd.total_boxes ?? 0;
                        const totalPieces = pd.total_pieces ?? 0;
                        const packingParts: string[] = [];
                        if (Number(totalBoxes) > 0) packingParts.push(`${totalBoxes} Box${Number(totalBoxes) !== 1 ? 'es' : ''}`);
                        if (Number(totalPieces) > 0) packingParts.push(`${totalPieces} Piece${Number(totalPieces) !== 1 ? 's' : ''}`);
                        const packingText = packingParts.length
                          ? packingParts.join(', ')
                          : (item.thaans != null || item.meters != null)
                            ? [item.thaans != null && item.thaans > 0 ? `${item.thaans} Thaan${item.thaans !== 1 ? 's' : ''}` : null, item.meters != null && item.meters > 0 ? `${item.meters}m` : null].filter(Boolean).join(' · ') || '—'
                            : '—';
                        const unitDisplay = item.unit ?? 'piece';
                        return (
                        <TableRow key={item.id} className="border-gray-800">
                          <TableCell>
                            <div>
                              <p className="font-medium text-white">{productName}</p>
                              {displaySku && displaySku !== 'N/A' && (
                                <p className="text-xs text-gray-500">SKU: {displaySku}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-gray-400">{displaySku}</TableCell>
                          <TableCell>
                            {(item.size || item.color) ? (
                              <div className="flex flex-wrap gap-1">
                                {item.size && (
                                  <Badge variant="outline" className="text-xs border-gray-700 text-gray-400">
                                    {item.size}
                                  </Badge>
                                )}
                                {item.color && (
                                  <Badge variant="outline" className="text-xs border-gray-700 text-gray-400">
                                    {item.color}
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-600">-</span>
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
                    <span className="text-white font-medium">Rs. {sale.subtotal.toLocaleString()}</span>
                  </div>
                  
                  {sale.discount && sale.discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Discount</span>
                      <span className="text-red-400 font-medium">- Rs. {sale.discount.toLocaleString()}</span>
                    </div>
                  )}
                  
                  {sale.tax && sale.tax > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Tax</span>
                      <span className="text-white font-medium">Rs. {sale.tax.toLocaleString()}</span>
                    </div>
                  )}
                  
                  {/* CRITICAL FIX: Show shipping charges clearly */}
                  {(sale.shippingCharges && sale.shippingCharges > 0) || (sale.expenses && sale.expenses > 0) ? (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Shipping Charges</span>
                      <span className="text-white font-medium">
                        Rs. {(sale.shippingCharges || sale.expenses || 0).toLocaleString()}
                      </span>
                    </div>
                  ) : null}
                  
                  {/* CRITICAL FIX: Show extra/other charges clearly */}
                  {sale.otherCharges && sale.otherCharges > 0 ? (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Extra Charges</span>
                      <span className="text-white font-medium">Rs. {sale.otherCharges.toLocaleString()}</span>
                    </div>
                  ) : null}
                  
                  {/* CRITICAL FIX: Show expenses if different from shipping */}
                  {sale.expenses && sale.expenses > 0 && sale.expenses !== (sale.shippingCharges || 0) ? (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Other Expenses</span>
                      <span className="text-white font-medium">Rs. {sale.expenses.toLocaleString()}</span>
                    </div>
                  ) : null}
                  
                  <Separator className="bg-gray-800" />
                  
                  <div className="flex justify-between">
                    <span className="text-gray-300 font-semibold">Grand Total</span>
                    <span className="text-white text-xl font-bold">Rs. {sale.total.toLocaleString()}</span>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Total Paid</span>
                    <span className="text-green-400 font-medium">Rs. {sale.paid.toLocaleString()}</span>
                  </div>
                  
                  {sale.due > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-400 font-medium">Amount Due</span>
                      <span className="text-red-400 text-lg font-bold">Rs. {sale.due.toLocaleString()}</span>
                    </div>
                  )}
                  
                  {sale.returnDue && sale.returnDue > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Return Due</span>
                      <span className="text-yellow-400 font-medium">Rs. {sale.returnDue.toLocaleString()}</span>
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
            </>
          )}

          {activeTab === 'payments' && (
            <div className="space-y-4">
              {/* Add Payment Button */}
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-white">Payment History</h3>
                {sale.due > 0 && (
                  <Button
                    onClick={() => {
                      onAddPayment?.(sale.id);
                      // CRITICAL FIX: Reload will happen via event listener (paymentAdded event)
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
                          Rs. {payments.filter(p => p.method === 'cash').reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
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
                          Rs. {payments.filter(p => p.method === 'bank' || p.method === 'card').reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
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
                          Rs. {payments.filter(p => p.method === 'other' || (p.method !== 'cash' && p.method !== 'bank' && p.method !== 'card')).reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
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
                          Rs. {sale.paid.toLocaleString()}
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
                    
                    {sale.due > 0 && (
                      <div className="flex justify-between text-sm pt-3 border-t border-gray-800">
                        <span className="text-gray-400">Amount Due:</span>
                        <span className="text-red-400 font-medium">
                          Rs. {sale.due.toLocaleString()}
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
                            Rs. {payment.amount.toLocaleString()}
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
                        </div>
                          <div className="flex items-center gap-2">
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
                            {/* CRITICAL FIX: Add edit and delete buttons for each payment */}
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
                        {/* CRITICAL FIX: Show attachment icon if payment has attachments */}
                        {payment.attachments && (
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-xs text-gray-500">Attachments:</span>
                            {Array.isArray(payment.attachments) ? (
                              payment.attachments.map((att: any, idx: number) => {
                                const url = att.url || att.fileUrl || att;
                                const name = att.name || att.fileName || `Attachment ${idx + 1}`;
                                const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
                                return (
                                  <button
                                    key={idx}
                                    onClick={() => window.open(url, '_blank')}
                                    className="flex items-center gap-1 px-2 py-1 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded text-blue-400 text-xs transition-colors"
                                  >
                                    {isImage ? <ImageIcon size={12} /> : <File size={12} />}
                                    <span>{name}</span>
                                    <Paperclip size={10} />
                                  </button>
                                );
                              })
                            ) : typeof payment.attachments === 'string' ? (
                              <button
                                onClick={() => window.open(payment.attachments, '_blank')}
                                className="flex items-center gap-1 px-2 py-1 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded text-blue-400 text-xs transition-colors"
                              >
                                <Paperclip size={12} />
                                <span>View Attachment</span>
                              </button>
                            ) : null}
                        </div>
                      )}
                        {payment.notes && (
                          <p className="text-xs text-gray-500 mt-2">{payment.notes}</p>
                      )}
                    </div>
                  ))}
                  </div>
                </div>
              ) : sale.paid > 0 ? (
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
                  <p className="text-white font-semibold text-lg">
                    Rs. {sale.paid.toLocaleString()}
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
        {activeTab === 'details' && sale.due > 0 && (
          <div className="border-t border-gray-800 px-6 py-4 bg-gray-900/50 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Amount Due</p>
                <p className="text-2xl font-bold text-red-400">Rs. {sale.due.toLocaleString()}</p>
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
                    description: `Payment of Rs ${paymentToDelete.amount.toLocaleString()} deleted from sale ${sale.invoiceNo}`,
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
            notes: paymentToEdit.notes
          }}
          onSuccess={async () => {
            toast.success('Payment updated successfully');
            await Promise.all([
              loadPayments(sale.id),
              reloadSaleData()
            ]);
            setEditPaymentDialogOpen(false);
            setPaymentToEdit(null);
          }}
        />
      )}
    </>
  );
};
