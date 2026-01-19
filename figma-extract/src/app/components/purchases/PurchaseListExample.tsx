import React, { useState } from 'react';
import { MoreVertical, Eye, DollarSign, Printer, Edit, Trash, Receipt } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { UnifiedPaymentDialog } from '@/app/components/shared/UnifiedPaymentDialog';
import { UnifiedLedgerView } from '@/app/components/shared/UnifiedLedgerView';

// ============================================
// 🎯 TYPES
// ============================================

interface Purchase {
  id: string;
  location: string;
  status: 'Received' | 'Ordered' | 'Partial';
  items: number;
  total: number;
  due: number;
  payment: 'Paid' | 'Partial' | 'Unpaid';
  addedBy: string;
  supplierName: string;
  supplierId?: string;
}

// ============================================
// 🎯 MOCK DATA
// ============================================

const mockPurchases: Purchase[] = [
  {
    id: 'PUR-1001',
    location: 'Main Branch (HQ)',
    status: 'Received',
    items: 24,
    total: 15000,
    due: 5000,
    payment: 'Partial',
    addedBy: 'Ahmad Khan',
    supplierName: 'Textile Suppliers Ltd',
    supplierId: 'SUP-001'
  },
  {
    id: 'PUR-1002',
    location: 'Warehouse',
    status: 'Received',
    items: 50,
    total: 120000,
    due: 120000,
    payment: 'Unpaid',
    addedBy: 'Sara Ali',
    supplierName: 'Rawalpindi Fabrics',
    supplierId: 'SUP-002'
  },
  {
    id: 'PUR-1003',
    location: 'Main Branch (HQ)',
    status: 'Ordered',
    items: 12,
    total: 45000,
    due: 45000,
    payment: 'Unpaid',
    addedBy: 'Ali Hassan',
    supplierName: 'Premium Textiles',
    supplierId: 'SUP-003'
  },
  {
    id: 'PUR-1004',
    location: 'Mall Outlet',
    status: 'Received',
    items: 30,
    total: 85000,
    due: 0,
    payment: 'Paid',
    addedBy: 'Ayesha Khan',
    supplierName: 'Karachi Fabrics',
    supplierId: 'SUP-004'
  },
  {
    id: 'PUR-1005',
    location: 'Warehouse',
    status: 'Received',
    items: 18,
    total: 32000,
    due: 15000,
    payment: 'Partial',
    addedBy: 'Sara Ali',
    supplierName: 'Textile Suppliers Ltd',
    supplierId: 'SUP-001'
  }
];

// ============================================
// 🎯 THREE-DOT MENU COMPONENT
// ============================================

interface ActionMenuProps {
  purchase: Purchase;
  onMakePayment: () => void;
  onViewLedger: () => void;
}

const ActionMenu: React.FC<ActionMenuProps> = ({ purchase, onMakePayment, onViewLedger }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-gray-400 hover:text-white p-2 hover:bg-gray-800 rounded-lg transition-colors"
      >
        <MoreVertical size={20} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="absolute right-0 mt-2 w-48 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-20 overflow-hidden">
            <button
              onClick={() => {
                setIsOpen(false);
                // View details action
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
            >
              <Eye size={16} className="text-blue-400" />
              View Details
            </button>

            <button
              onClick={() => {
                setIsOpen(false);
                // Edit action
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
            >
              <Edit size={16} className="text-gray-400" />
              Edit Purchase
            </button>

            <button
              onClick={() => {
                setIsOpen(false);
                // Print action
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
            >
              <Printer size={16} className="text-gray-400" />
              Print PO
            </button>

            {/* DIVIDER */}
            <div className="border-t border-gray-800 my-1" />

            {/* 🎯 MAKE PAYMENT - Only show if there's a due amount */}
            {purchase.due > 0 && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onMakePayment();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-yellow-400 hover:bg-yellow-500/10 transition-colors font-medium"
              >
                <DollarSign size={16} className="text-yellow-400" />
                Make Payment
              </button>
            )}

            {/* 🎯 VIEW LEDGER */}
            <button
              onClick={() => {
                setIsOpen(false);
                onViewLedger();
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-blue-400 hover:bg-blue-500/10 transition-colors font-medium"
            >
              <Receipt size={16} className="text-blue-400" />
              View Ledger
            </button>

            {/* DIVIDER */}
            <div className="border-t border-gray-800 my-1" />

            <button
              onClick={() => {
                setIsOpen(false);
                // Delete action
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash size={16} className="text-red-400" />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// ============================================
// 🎯 PURCHASE LIST EXAMPLE
// ============================================

export const PurchaseListExample = () => {
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);

  const handleMakePayment = (purchase: Purchase) => {
    setSelectedPurchase(purchase);
    setPaymentDialogOpen(true);
  };

  const handleViewLedger = (purchase: Purchase) => {
    setSelectedPurchase(purchase);
    setLedgerOpen(true);
  };

  // Get status badge color
  const getStatusBadge = (status: Purchase['status']) => {
    switch (status) {
      case 'Received':
        return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'Ordered':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'Partial':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  // Get payment badge color
  const getPaymentBadge = (payment: Purchase['payment']) => {
    switch (payment) {
      case 'Paid':
        return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'Partial':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'Unpaid':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Purchases</h1>
        <p className="text-gray-400">Manage purchase orders and supplier transactions</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <p className="text-sm text-gray-400 mb-1">TOTAL PURCHASE</p>
          <p className="text-3xl font-bold text-white mb-1">$297,000</p>
          <p className="text-xs text-gray-500">This month</p>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <p className="text-sm text-gray-400 mb-1">AMOUNT DUE</p>
          <p className="text-3xl font-bold text-red-400 mb-1">$185,000</p>
          <p className="text-xs text-gray-500">Pending payments</p>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <p className="text-sm text-gray-400 mb-1">RETURNS</p>
          <p className="text-3xl font-bold text-orange-400 mb-1">$2,500</p>
          <p className="text-xs text-gray-500">2 items returned</p>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <p className="text-sm text-gray-400 mb-1">PURCHASE ORDERS</p>
          <p className="text-3xl font-bold text-blue-400 mb-1">5</p>
          <p className="text-xs text-gray-500">Active orders</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left p-4 text-sm font-medium text-gray-400 uppercase">Location</th>
                <th className="text-left p-4 text-sm font-medium text-gray-400 uppercase">Status</th>
                <th className="text-left p-4 text-sm font-medium text-gray-400 uppercase">Items</th>
                <th className="text-left p-4 text-sm font-medium text-gray-400 uppercase">Total</th>
                <th className="text-left p-4 text-sm font-medium text-gray-400 uppercase">Due</th>
                <th className="text-left p-4 text-sm font-medium text-gray-400 uppercase">Payment</th>
                <th className="text-left p-4 text-sm font-medium text-gray-400 uppercase">Added By</th>
                <th className="text-left p-4 text-sm font-medium text-gray-400 uppercase">Action</th>
              </tr>
            </thead>
            <tbody>
              {mockPurchases.map((purchase) => (
                <tr key={purchase.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-2 text-gray-300">
                      <div className="w-2 h-2 bg-gray-600 rounded-full" />
                      {purchase.location}
                    </div>
                  </td>
                  <td className="p-4">
                    <Badge variant="outline" className={getStatusBadge(purchase.status)}>
                      {purchase.status}
                    </Badge>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2 text-gray-300">
                      <span className="text-gray-500">📦</span>
                      {purchase.items}
                    </div>
                  </td>
                  <td className="p-4 text-white font-semibold">${purchase.total.toLocaleString()}</td>
                  <td className="p-4">
                    {purchase.due > 0 ? (
                      <span className="text-red-400 font-semibold">${purchase.due.toLocaleString()}</span>
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                  </td>
                  <td className="p-4">
                    <Badge variant="outline" className={getPaymentBadge(purchase.payment)}>
                      {purchase.payment}
                    </Badge>
                  </td>
                  <td className="p-4 text-gray-300">{purchase.addedBy}</td>
                  <td className="p-4">
                    <ActionMenu
                      purchase={purchase}
                      onMakePayment={() => handleMakePayment(purchase)}
                      onViewLedger={() => handleViewLedger(purchase)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Box */}
      <div className="mt-8 p-6 bg-blue-500/10 border border-blue-500/20 rounded-xl">
        <h3 className="text-lg font-bold text-blue-400 mb-2">🎯 Unified Payment System Demo</h3>
        <p className="text-sm text-gray-300 mb-3">
          Click on the three-dot menu (⋮) in the ACTION column to see:
        </p>
        <ul className="space-y-2 text-sm text-gray-400">
          <li className="flex items-center gap-2">
            <DollarSign size={14} className="text-yellow-400" />
            <span><strong className="text-yellow-400">Make Payment</strong> - Opens unified payment dialog (only shows if amount is due)</span>
          </li>
          <li className="flex items-center gap-2">
            <Receipt size={14} className="text-blue-400" />
            <span><strong className="text-blue-400">View Ledger</strong> - Opens unified ledger view for supplier</span>
          </li>
        </ul>
        <p className="text-xs text-gray-500 mt-4">
          💡 Both components are reused across Purchase, Sale, and Accounting modules with zero code duplication!
        </p>
      </div>

      {/* 🎯 UNIFIED PAYMENT DIALOG */}
      {selectedPurchase && (
        <UnifiedPaymentDialog
          isOpen={paymentDialogOpen}
          onClose={() => {
            setPaymentDialogOpen(false);
            setSelectedPurchase(null);
          }}
          context="supplier"
          entityName={selectedPurchase.supplierName}
          entityId={selectedPurchase.supplierId}
          outstandingAmount={selectedPurchase.due}
          referenceNo={selectedPurchase.id}
          onSuccess={() => {
            // Refresh purchase list
            console.log('Payment successful! Refresh list here.');
          }}
        />
      )}

      {/* 🎯 UNIFIED LEDGER VIEW */}
      {selectedPurchase && (
        <UnifiedLedgerView
          isOpen={ledgerOpen}
          onClose={() => {
            setLedgerOpen(false);
            setSelectedPurchase(null);
          }}
          entityType="supplier"
          entityName={selectedPurchase.supplierName}
          entityId={selectedPurchase.supplierId}
        />
      )}
    </div>
  );
};
