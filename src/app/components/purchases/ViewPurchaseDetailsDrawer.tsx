import React, { useEffect, useState } from 'react';
import { X, ShoppingBag, DollarSign, Package, User, Calendar, FileText, Receipt, Truck, CheckCircle, Clock, XCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { purchaseService } from '@/app/services/purchaseService';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface Purchase {
  id: number;
  uuid: string;
  poNo: string;
  supplier: string;
  supplierContact: string;
  date: string;
  reference: string;
  location: string;
  items: number;
  grandTotal: number;
  paymentDue: number;
  status: 'received' | 'ordered' | 'pending';
  paymentStatus: 'paid' | 'partial' | 'unpaid';
  addedBy: string;
}

interface ViewPurchaseDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  purchase: Purchase | null;
}

export const ViewPurchaseDetailsDrawer: React.FC<ViewPurchaseDetailsDrawerProps> = ({
  isOpen,
  onClose,
  purchase,
}) => {
  const [purchaseDetails, setPurchaseDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && purchase?.uuid) {
      loadPurchaseDetails();
    }
  }, [isOpen, purchase?.uuid]);

  const loadPurchaseDetails = async () => {
    if (!purchase?.uuid) return;
    
    try {
      setLoading(true);
      const data = await purchaseService.getPurchase(purchase.uuid);
      setPurchaseDetails(data);
    } catch (error: any) {
      console.error('[VIEW PURCHASE] Error loading details:', error);
      toast.error('Failed to load purchase details: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !purchase) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'received':
        return <Badge className="bg-green-500/10 text-green-400 border-green-500/30">Received</Badge>;
      case 'ordered':
        return <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30">Ordered</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30">Pending</Badge>;
      default:
        return <Badge className="bg-gray-500/10 text-gray-400 border-gray-500/30">{status}</Badge>;
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-500/10 text-green-400 border-green-500/30">Paid</Badge>;
      case 'partial':
        return <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30">Partial</Badge>;
      case 'unpaid':
        return <Badge className="bg-red-500/10 text-red-400 border-red-500/30">Unpaid</Badge>;
      default:
        return <Badge className="bg-gray-500/10 text-gray-400 border-gray-500/30">{status}</Badge>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-[#0B0F17] h-full shadow-2xl flex flex-col border-l border-gray-800 animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-800 bg-[#111827] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <ShoppingBag size={20} className="text-orange-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Purchase Order Details</h2>
              <p className="text-xs text-gray-400">{purchase.poNo}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-gray-400 hover:text-white hover:bg-gray-800"
          >
            <X size={20} />
          </Button>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={32} className="text-blue-500 animate-spin" />
              </div>
            ) : (
              <>
                {/* Purchase Header */}
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-white mb-1">PO {purchase.poNo}</h3>
                      <p className="text-sm text-gray-400">Reference: {purchase.reference || 'N/A'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(purchase.status)}
                      {getPaymentStatusBadge(purchase.paymentStatus)}
                    </div>
                  </div>
                </div>

                {/* Supplier Information */}
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                  <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                    <User size={16} />
                    Supplier Information
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Supplier Name</p>
                      <p className="text-sm text-white font-medium">{purchase.supplier}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Contact</p>
                      <p className="text-sm text-white font-medium">{purchase.supplierContact || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Purchase Information */}
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                  <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                    <FileText size={16} />
                    Purchase Information
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Date</p>
                      <p className="text-sm text-white font-medium">{new Date(purchase.date).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Location</p>
                      <p className="text-sm text-white font-medium">{purchase.location}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Items Count</p>
                      <p className="text-sm text-white font-medium">{purchase.items}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Added By</p>
                      <p className="text-sm text-white font-medium">{purchase.addedBy}</p>
                    </div>
                  </div>
                </div>

                {/* Financial Information */}
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                  <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                    <DollarSign size={16} />
                    Financial Information
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Grand Total</p>
                      <p className="text-lg text-white font-semibold">${purchase.grandTotal.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Payment Due</p>
                      <p className={`text-lg font-semibold ${purchase.paymentDue > 0 ? 'text-red-400' : 'text-green-400'}`}>
                        ${purchase.paymentDue.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Paid Amount</p>
                      <p className="text-lg text-green-400 font-semibold">
                        ${(purchase.grandTotal - purchase.paymentDue).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Purchase Items */}
                {purchaseDetails?.items && purchaseDetails.items.length > 0 && (
                  <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                    <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                      <Package size={16} />
                      Purchase Items ({purchaseDetails.items.length})
                    </h4>
                    <div className="space-y-3">
                      {purchaseDetails.items.map((item: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                          <div className="flex-1">
                            <p className="text-sm text-white font-medium">{item.product_name || item.product?.name || 'Unknown Product'}</p>
                            <p className="text-xs text-gray-400">Qty: {item.quantity} × ${item.unit_price?.toLocaleString() || '0'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-white font-semibold">${item.total?.toLocaleString() || '0'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Additional Details from Database */}
                {purchaseDetails && (
                  <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                    <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                      <FileText size={16} />
                      Additional Details
                    </h4>
                    <div className="space-y-3">
                      {purchaseDetails.subtotal && (
                        <div className="flex justify-between">
                          <p className="text-xs text-gray-400">Subtotal</p>
                          <p className="text-sm text-white">${purchaseDetails.subtotal.toLocaleString()}</p>
                        </div>
                      )}
                      {purchaseDetails.discount_amount > 0 && (
                        <div className="flex justify-between">
                          <p className="text-xs text-gray-400">Discount</p>
                          <p className="text-sm text-red-400">-${purchaseDetails.discount_amount.toLocaleString()}</p>
                        </div>
                      )}
                      {purchaseDetails.tax_amount > 0 && (
                        <div className="flex justify-between">
                          <p className="text-xs text-gray-400">Tax</p>
                          <p className="text-sm text-white">${purchaseDetails.tax_amount.toLocaleString()}</p>
                        </div>
                      )}
                      {purchaseDetails.shipping_cost > 0 && (
                        <div className="flex justify-between">
                          <p className="text-xs text-gray-400">Shipping</p>
                          <p className="text-sm text-white">${purchaseDetails.shipping_cost.toLocaleString()}</p>
                        </div>
                      )}
                      {purchaseDetails.notes && (
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Notes</p>
                          <p className="text-sm text-gray-300">{purchaseDetails.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 bg-[#111827] shrink-0 flex items-center justify-end gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
