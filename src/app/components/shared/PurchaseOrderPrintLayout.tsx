import React from 'react';
import { Purchase } from '@/app/context/PurchaseContext';

interface PurchaseOrderPrintLayoutProps {
  purchase: Purchase;
  onClose?: () => void;
}

export const PurchaseOrderPrintLayout: React.FC<PurchaseOrderPrintLayoutProps> = ({ purchase, onClose }) => {
  const handlePrint = () => {
    window.print();
    if (onClose) onClose();
  };

  return (
    <div className="print-container">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-container, .print-container * {
            visibility: visible;
          }
          .print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
            color: black;
          }
          .no-print {
            display: none;
          }
        }
        @media screen {
          .print-container {
            background: white;
            color: black;
            padding: 40px;
            max-width: 800px;
            margin: 0 auto;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
          }
        }
      `}</style>
      
      <div className="print-container">
        {/* Print Button - Hidden when printing */}
        <div className="no-print mb-4 flex gap-2">
          <button
            onClick={handlePrint}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Print Purchase Order
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
            >
              Close
            </button>
          )}
        </div>

        {/* Purchase Order Content */}
        <div className="invoice-content">
          {/* Header */}
          <div className="mb-8 text-center border-b-2 border-gray-300 pb-4">
            <h1 className="text-3xl font-bold mb-2">PURCHASE ORDER</h1>
            <p className="text-gray-600">Din Collection</p>
            <p className="text-sm text-gray-500">ERP System</p>
          </div>

          {/* PO Details */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="font-semibold mb-2">Supplier:</h3>
              <p className="text-sm">{purchase.supplierName}</p>
              <p className="text-sm text-gray-600">{purchase.contactNumber}</p>
              <p className="text-sm text-gray-600">{purchase.location}</p>
            </div>
            <div className="text-right">
              <p className="text-sm mb-1"><strong>PO No:</strong> {purchase.purchaseNo}</p>
              <p className="text-sm mb-1"><strong>Date:</strong> {new Date(purchase.date).toLocaleDateString()}</p>
              <p className="text-sm"><strong>Status:</strong> {purchase.status}</p>
            </div>
          </div>

          {/* Items Table */}
          <table className="w-full border-collapse mb-6">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-gray-300">
                <th className="text-left p-2 font-semibold">Product</th>
                <th className="text-left p-2 font-semibold">SKU</th>
                <th className="text-right p-2 font-semibold">Qty</th>
                <th className="text-right p-2 font-semibold">Price</th>
                <th className="text-right p-2 font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {purchase.items.map((item, index) => (
                <tr key={item.id || index} className="border-b border-gray-200">
                  <td className="p-2">{item.productName}</td>
                  <td className="p-2 text-gray-600">{item.sku}</td>
                  <td className="p-2 text-right">{item.quantity}</td>
                  <td className="p-2 text-right">Rs. {item.price.toLocaleString()}</td>
                  <td className="p-2 text-right font-semibold">Rs. {(item.price * item.quantity).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end mb-6">
            <div className="w-64">
              <div className="flex justify-between py-2 border-b border-gray-300">
                <span>Subtotal:</span>
                <span>Rs. {purchase.subtotal.toLocaleString()}</span>
              </div>
              {purchase.discount > 0 && (
                <div className="flex justify-between py-2 border-b border-gray-300">
                  <span>Discount:</span>
                  <span>- Rs. {purchase.discount.toLocaleString()}</span>
                </div>
              )}
              {purchase.tax > 0 && (
                <div className="flex justify-between py-2 border-b border-gray-300">
                  <span>Tax:</span>
                  <span>Rs. {purchase.tax.toLocaleString()}</span>
                </div>
              )}
              {purchase.shippingCost > 0 && (
                <div className="flex justify-between py-2 border-b border-gray-300">
                  <span>Shipping:</span>
                  <span>Rs. {purchase.shippingCost.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between py-2 font-bold text-lg border-t-2 border-gray-400 mt-2">
                <span>Total:</span>
                <span>Rs. {purchase.total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-2 border-t border-gray-300 mt-2">
                <span>Paid:</span>
                <span className="text-green-600">Rs. {purchase.paid.toLocaleString()}</span>
              </div>
              {purchase.due > 0 && (
                <div className="flex justify-between py-2 font-semibold">
                  <span>Due:</span>
                  <span className="text-red-600">Rs. {purchase.due.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Payment Status */}
          <div className="mb-6">
            <p className="text-sm">
              <strong>Payment Status:</strong> {purchase.paymentStatus === 'paid' ? 'Paid' : purchase.paymentStatus === 'partial' ? 'Partial' : 'Unpaid'}
            </p>
            <p className="text-sm">
              <strong>Payment Method:</strong> {purchase.paymentMethod || 'Cash'}
            </p>
          </div>

          {/* Notes */}
          {purchase.notes && (
            <div className="mb-6 p-4 bg-gray-50 rounded">
              <p className="text-sm"><strong>Notes:</strong></p>
              <p className="text-sm text-gray-700">{purchase.notes}</p>
            </div>
          )}

          {/* Footer */}
          <div className="text-center text-sm text-gray-500 border-t border-gray-300 pt-4">
            <p>Thank you for your business!</p>
            <p className="mt-2">Generated on {new Date().toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
