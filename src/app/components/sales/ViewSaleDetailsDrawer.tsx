import React, { useState, useEffect } from 'react';
import { useSales, Sale } from '@/app/context/SalesContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { branchService, Branch } from '@/app/services/branchService';
import { InvoicePrintLayout } from '../shared/InvoicePrintLayout';
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
  MoreVertical
} from 'lucide-react';
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { cn } from "../ui/utils";
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
  packingDetails?: any;
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
  const { companyId } = useSupabase();
  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPrintLayout, setShowPrintLayout] = useState(false);
  const [branchMap, setBranchMap] = useState<Map<string, string>>(new Map());

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
      const saleData = getSaleById(saleId);
      if (saleData) {
        setSale(saleData);
      }
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [isOpen, saleId, getSaleById]);

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
                      <p className="text-sm text-gray-400">{sale.customer}</p>
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
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">Date</span>
                      <span className="text-white flex items-center gap-2">
                        <Calendar size={14} className="text-gray-500" />
                        {new Date(sale.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
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
                        <TableHead className="text-gray-400 text-right">Unit Price</TableHead>
                        <TableHead className="text-gray-400 text-center">Qty</TableHead>
                        <TableHead className="text-gray-400 text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sale.items.map((item) => (
                        <TableRow key={item.id} className="border-gray-800">
                          <TableCell>
                            <div>
                              <p className="font-medium text-white">{item.name}</p>
                              {(item.thaans || item.meters) && (
                                <p className="text-xs text-gray-500">
                                  {item.thaans && `${item.thaans} Thaans`}
                                  {item.thaans && item.meters && ' • '}
                                  {item.meters && `${item.meters}m`}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-gray-400">{item.sku}</TableCell>
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
                          <TableCell className="text-right text-white">
                            Rs. {item.price.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-center text-white font-medium">
                            {item.quantity || (item as any).qty || 0}
                          </TableCell>
                          <TableCell className="text-right text-white font-medium">
                            Rs. {(item.price * (item.quantity || (item as any).qty || 0)).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
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
                  
                  {sale.shippingCharges && sale.shippingCharges > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Shipping Charges</span>
                      <span className="text-white font-medium">Rs. {sale.shippingCharges.toLocaleString()}</span>
                    </div>
                  )}
                  
                  {sale.otherCharges && sale.otherCharges > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Other Charges</span>
                      <span className="text-white font-medium">Rs. {sale.otherCharges.toLocaleString()}</span>
                    </div>
                  )}
                  
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
                    onClick={() => onAddPayment?.(sale.id)}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <CreditCard size={16} className="mr-2" />
                    Add Payment
                  </Button>
                )}
              </div>

              {/* Payment Summary - Sale type doesn't have payments array */}
              {sale.paid > 0 ? (
                <div className="space-y-3">
                  <div 
                    className="bg-gray-900/50 border border-gray-800 rounded-xl p-5"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-white font-semibold text-lg">
                          Rs. {sale.paid.toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-400 mt-1">
                          Total paid amount
                        </p>
                      </div>
                      <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                        <CheckCircle2 size={12} className="mr-1" />
                        {sale.paymentMethod || 'Cash'}
                      </Badge>
                    </div>
                    
                    <div className="text-sm space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Payment Status:</span>
                        <span className={sale.paymentStatus === 'paid' ? "text-green-400" : sale.paymentStatus === 'partial' ? "text-yellow-400" : "text-red-400"}>
                          {sale.paymentStatus === 'paid' ? 'Paid' : sale.paymentStatus === 'partial' ? 'Partial' : 'Unpaid'}
                        </span>
                      </div>
                      {sale.due > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Amount Due:</span>
                          <span className="text-red-400 font-medium">
                            Rs. {sale.due.toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-3">
                      Note: Detailed payment history can be viewed in the Ledger tab
                    </p>
                  </div>
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
              
              {/* Timeline */}
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                      <CheckCircle2 size={16} className="text-green-500" />
                    </div>
                    <div className="w-0.5 h-full bg-gray-800 mt-2" />
                  </div>
                  <div className="flex-1 pb-6">
                    <p className="text-white font-medium">Sale Finalized</p>
                    <p className="text-sm text-gray-400 mt-1">{sale.updatedAt || sale.createdAt}</p>
                    <p className="text-sm text-gray-500 mt-1">Status changed to Final</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <DollarSign size={16} className="text-blue-500" />
                    </div>
                    <div className="w-0.5 h-full bg-gray-800 mt-2" />
                  </div>
                  <div className="flex-1 pb-6">
                    <p className="text-white font-medium">Payment Received</p>
                    <p className="text-sm text-gray-400 mt-1">{sale.createdAt}</p>
                    <p className="text-sm text-gray-500 mt-1">Rs. {sale.paid.toLocaleString()} received via {sale.paymentMethod || 'Cash'}</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-gray-700/20 flex items-center justify-center">
                      <FileText size={16} className="text-gray-500" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium">Sale Created</p>
                    <p className="text-sm text-gray-400 mt-1">{sale.createdAt}</p>
                    <p className="text-sm text-gray-500 mt-1">Sale created on {new Date(sale.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              </div>
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
    </>
  );
};
