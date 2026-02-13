import React from 'react';
import { ClassicPrintBase } from './ClassicPrintBase';
import { usePrinterConfig } from '@/app/hooks/usePrinterConfig';
import { RentalUI } from '@/app/context/RentalContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';

interface RentalPrintLayoutProps {
  rental: RentalUI;
  onClose?: () => void;
}

export const RentalPrintLayout: React.FC<RentalPrintLayoutProps> = ({ rental, onClose }) => {
  const { formatCurrency } = useFormatCurrency();
  const { config: printerConfig } = usePrinterConfig();
  const headerMeta = [
    { label: 'Booking No', value: rental.rentalNo },
    { label: 'Date', value: rental.startDate ? new Date(rental.startDate).toLocaleDateString() : '—' },
    { label: 'Customer', value: rental.customerName },
  ];

  const statusLabel =
    rental.status === 'booked'
      ? 'Booked'
      : rental.status === 'draft'
        ? 'Draft'
        : rental.status === 'rented'
          ? 'Rented'
          : rental.status === 'returned'
            ? 'Returned'
            : rental.status === 'overdue'
              ? 'Overdue'
              : rental.status === 'cancelled'
                ? 'Cancelled'
                : rental.status;

  return (
    <ClassicPrintBase
      documentTitle="RENTAL BOOKING"
      companyName="Rental"
      headerMeta={headerMeta}
      onPrint={() => window.print()}
      onClose={onClose}
      printerMode={printerConfig.mode}
      showActions={true}
    >
      <div className="space-y-6 mt-6">
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold">Status:</span>
          <span className="text-sm font-bold">{statusLabel}</span>
        </div>

        <div className="border-t border-gray-300 pt-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Dates</p>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Pickup</p>
              <p className="font-medium">{rental.startDate ? new Date(rental.startDate).toLocaleDateString() : '—'}</p>
            </div>
            <div>
              <p className="text-gray-500">Expected Return</p>
              <p className="font-medium">{rental.expectedReturnDate ? new Date(rental.expectedReturnDate).toLocaleDateString() : '—'}</p>
            </div>
            {rental.actualReturnDate && (
              <div>
                <p className="text-gray-500">Actual Return</p>
                <p className="font-medium">{new Date(rental.actualReturnDate).toLocaleDateString()}</p>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-gray-300 pt-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Items</p>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="text-left py-2">Product</th>
                <th className="text-right py-2">Qty</th>
                <th className="text-right py-2">Rate</th>
                <th className="text-right py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {(rental.items || []).map((item) => (
                <tr key={item.id} className="border-b border-gray-200">
                  <td className="py-2">{item.productName || '—'}</td>
                  <td className="text-right py-2">{item.quantity}</td>
                  <td className="text-right py-2">{formatCurrency(Number(item.rate || 0))}</td>
                  <td className="text-right py-2 font-medium">{formatCurrency(Number(item.total || 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-gray-300 pt-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Summary</p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Total:</span>
              <span className="font-bold">{formatCurrency(rental.totalAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span>Paid:</span>
              <span className="text-green-600">{formatCurrency(rental.paidAmount)}</span>
            </div>
            {rental.dueAmount > 0 && (
              <div className="flex justify-between">
                <span>Due:</span>
                <span className="font-bold text-red-600">{formatCurrency(rental.dueAmount)}</span>
              </div>
            )}
          </div>
        </div>

        {rental.notes && (
          <div className="border-t border-gray-300 pt-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Notes</p>
            <p className="text-sm">{rental.notes}</p>
          </div>
        )}
      </div>
    </ClassicPrintBase>
  );
};
