import { useState } from 'react';
import { ArrowLeft, ShoppingBag, Plus, Search, Package, Calendar, DollarSign, CheckCircle } from 'lucide-react';
import { User } from '../../App';
import { CreatePurchaseFlow } from './CreatePurchaseFlow';

interface PurchaseModuleProps {
  onBack: () => void;
  user: User;
}

interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplier: string;
  supplierPhone: string;
  items: PurchaseItem[];
  subtotal: number;
  discount: number;
  total: number;
  paidAmount: number;
  dueAmount: number;
  status: 'draft' | 'sent' | 'confirmed' | 'received' | 'cancelled';
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  orderDate: Date;
  expectedDeliveryDate: Date;
}

interface PurchaseItem {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export function PurchaseModule({ onBack, user }: PurchaseModuleProps) {
  const [view, setView] = useState<'list' | 'create' | 'details'>('list');
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Mock data
  const [orders] = useState<PurchaseOrder[]>([
    {
      id: '1',
      orderNumber: 'PO-0001',
      supplier: 'ABC Textiles',
      supplierPhone: '0300-1111111',
      items: [
        { id: '1', productName: 'Cotton Fabric - White', quantity: 50, unitPrice: 500, total: 25000 },
        { id: '2', productName: 'Silk Fabric - Red', quantity: 30, unitPrice: 1200, total: 36000 },
      ],
      subtotal: 61000,
      discount: 1000,
      total: 60000,
      paidAmount: 30000,
      dueAmount: 30000,
      status: 'confirmed',
      paymentStatus: 'partial',
      orderDate: new Date('2026-01-15'),
      expectedDeliveryDate: new Date('2026-01-20'),
    },
    {
      id: '2',
      orderNumber: 'PO-0002',
      supplier: 'XYZ Suppliers',
      supplierPhone: '0321-2222222',
      items: [
        { id: '3', productName: 'Thread - Black', quantity: 100, unitPrice: 50, total: 5000 },
        { id: '4', productName: 'Buttons - Pearl', quantity: 200, unitPrice: 25, total: 5000 },
        { id: '5', productName: 'Zippers', quantity: 50, unitPrice: 80, total: 4000 },
      ],
      subtotal: 14000,
      discount: 0,
      total: 14000,
      paidAmount: 14000,
      dueAmount: 0,
      status: 'received',
      paymentStatus: 'paid',
      orderDate: new Date('2026-01-12'),
      expectedDeliveryDate: new Date('2026-01-17'),
    },
    {
      id: '3',
      orderNumber: 'PO-0003',
      supplier: 'Premium Fabrics Ltd',
      supplierPhone: '0333-3333333',
      items: [
        { id: '6', productName: 'Premium Silk - Golden', quantity: 20, unitPrice: 2500, total: 50000 },
      ],
      subtotal: 50000,
      discount: 2000,
      total: 48000,
      paidAmount: 0,
      dueAmount: 48000,
      status: 'sent',
      paymentStatus: 'unpaid',
      orderDate: new Date('2026-01-17'),
      expectedDeliveryDate: new Date('2026-01-25'),
    },
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'text-[#9CA3AF] bg-[#9CA3AF]/10';
      case 'sent':
        return 'text-[#3B82F6] bg-[#3B82F6]/10';
      case 'confirmed':
        return 'text-[#F59E0B] bg-[#F59E0B]/10';
      case 'received':
        return 'text-[#10B981] bg-[#10B981]/10';
      case 'cancelled':
        return 'text-[#EF4444] bg-[#EF4444]/10';
      default:
        return 'text-[#9CA3AF] bg-[#9CA3AF]/10';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'unpaid':
        return 'text-[#EF4444]';
      case 'partial':
        return 'text-[#F59E0B]';
      case 'paid':
        return 'text-[#10B981]';
      default:
        return 'text-[#9CA3AF]';
    }
  };

  const filteredOrders = orders.filter(order =>
    order.supplier.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (view === 'details' && selectedOrder) {
    return (
      <div className="min-h-screen pb-24">
        {/* Header */}
        <div className="bg-[#1F2937] border-b border-[#374151] p-4 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setView('list');
                setSelectedOrder(null);
              }}
              className="p-2 hover:bg-[#374151] rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold">{selectedOrder.orderNumber}</h1>
              <p className="text-xs text-[#9CA3AF]">{selectedOrder.supplier}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedOrder.status)}`}>
              {selectedOrder.status.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Order Details */}
        <div className="p-4 space-y-4">
          {/* Supplier Info */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <h3 className="text-sm font-medium mb-3">Supplier Information</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Name:</span>
                <span>{selectedOrder.supplier}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Phone:</span>
                <span>{selectedOrder.supplierPhone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Order Date:</span>
                <span>{selectedOrder.orderDate.toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Expected Delivery:</span>
                <span className="text-[#F59E0B]">
                  {selectedOrder.expectedDeliveryDate.toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <h3 className="text-sm font-medium mb-3">Items ({selectedOrder.items.length})</h3>
            <div className="space-y-3">
              {selectedOrder.items.map((item) => (
                <div key={item.id} className="pb-3 border-b border-[#374151] last:border-0">
                  <div className="flex justify-between mb-1">
                    <span className="font-medium">{item.productName}</span>
                    <span className="text-[#10B981]">Rs. {item.total.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs text-[#9CA3AF]">
                    <span>Qty: {item.quantity}</span>
                    <span>@ Rs. {item.unitPrice.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[#9CA3AF]">Subtotal:</span>
              <span>Rs. {selectedOrder.subtotal.toLocaleString()}</span>
            </div>
            {selectedOrder.discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-[#9CA3AF]">Discount:</span>
                <span className="text-[#EF4444]">- Rs. {selectedOrder.discount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-[#374151]">
              <span>Total:</span>
              <span className="text-[#10B981]">Rs. {selectedOrder.total.toLocaleString()}</span>
            </div>
          </div>

          {/* Payment Status */}
          <div className="bg-gradient-to-br from-[#10B981]/10 to-[#3B82F6]/10 border border-[#10B981]/30 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[#9CA3AF]">Paid Amount:</span>
              <span className="text-[#10B981]">Rs. {selectedOrder.paidAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span>Amount Due:</span>
              <span className={getPaymentStatusColor(selectedOrder.paymentStatus)}>
                Rs. {selectedOrder.dueAmount.toLocaleString()}
              </span>
            </div>
            <div className="pt-2 border-t border-[#10B981]/30">
              <span className={`text-xs font-medium ${getPaymentStatusColor(selectedOrder.paymentStatus)}`}>
                {selectedOrder.paymentStatus === 'paid' && '✓ Fully Paid'}
                {selectedOrder.paymentStatus === 'partial' && '⚠ Partially Paid'}
                {selectedOrder.paymentStatus === 'unpaid' && '✗ Unpaid'}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'create') {
    return (
      <CreatePurchaseFlow 
        onBack={() => setView('list')}
        onComplete={() => setView('list')}
      />
    );
  }

  // List View
  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#10B981] to-[#059669] p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold">Purchase Orders</h1>
            <p className="text-xs text-white/80">Supplier orders & bills</p>
          </div>
          <button
            onClick={() => setView('create')}
            className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search orders..."
            className="w-full h-10 bg-white/10 border border-white/20 rounded-lg pl-10 pr-4 text-sm placeholder:text-white/60 focus:outline-none focus:bg-white/20"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="p-4 grid grid-cols-3 gap-3">
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-3 text-center">
          <p className="text-xs text-[#9CA3AF] mb-1">Total</p>
          <p className="text-xl font-bold text-[#3B82F6]">{orders.length}</p>
        </div>
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-3 text-center">
          <p className="text-xs text-[#9CA3AF] mb-1">Pending</p>
          <p className="text-xl font-bold text-[#F59E0B]">
            {orders.filter(o => o.status !== 'received').length}
          </p>
        </div>
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-3 text-center">
          <p className="text-xs text-[#9CA3AF] mb-1">Received</p>
          <p className="text-xl font-bold text-[#10B981]">
            {orders.filter(o => o.status === 'received').length}
          </p>
        </div>
      </div>

      {/* Orders List */}
      <div className="p-4 space-y-3">
        {filteredOrders.map((order) => (
          <button
            key={order.id}
            onClick={() => {
              setSelectedOrder(order);
              setView('details');
            }}
            className="w-full bg-[#1F2937] border border-[#374151] rounded-xl p-4 hover:border-[#10B981] transition-all text-left"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-medium mb-1">{order.orderNumber}</h3>
                <p className="text-sm text-[#D1D5DB]">{order.supplier}</p>
                <p className="text-xs text-[#9CA3AF]">{order.supplierPhone}</p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                {order.status}
              </span>
            </div>

            <div className="flex items-center gap-2 mb-3 text-xs text-[#9CA3AF]">
              <Package className="w-4 h-4" />
              <span>{order.items.length} items</span>
              <span className="text-[#374151]">•</span>
              <Calendar className="w-4 h-4" />
              <span>
                {order.expectedDeliveryDate.toLocaleDateString('en-US', { 
                  day: 'numeric', 
                  month: 'short' 
                })}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <div>
                <span className="text-[#9CA3AF]">Total: </span>
                <span className="font-semibold">Rs. {order.total.toLocaleString()}</span>
              </div>
              <div className="text-right">
                <div className="text-xs text-[#9CA3AF]">Amount Due</div>
                <div className={`font-semibold ${getPaymentStatusColor(order.paymentStatus)}`}>
                  Rs. {order.dueAmount.toLocaleString()}
                </div>
              </div>
            </div>
          </button>
        ))}

        {filteredOrders.length === 0 && (
          <div className="text-center py-12">
            <ShoppingBag className="w-16 h-16 mx-auto mb-4 text-[#374151]" />
            <p className="text-[#9CA3AF]">No purchase orders found</p>
          </div>
        )}
      </div>
    </div>
  );
}