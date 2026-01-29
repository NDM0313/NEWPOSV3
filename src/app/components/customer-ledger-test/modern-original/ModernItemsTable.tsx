import type { InvoiceItem } from '../../types/index';

interface ModernItemsTableProps {
  items: InvoiceItem[];
}

export function ModernItemsTable({ items }: ModernItemsTableProps) {
  if (!items || items.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 text-sm">
        No items found
      </div>
    );
  }

  return (
    <div className="p-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 bg-gray-950/95">
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Item Name</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Qty</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Rate</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Line Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr
              key={index}
              className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
            >
              <td className="px-4 py-3 text-white">{item.itemName}</td>
              <td className="px-4 py-3 text-right text-white tabular-nums">{item.qty}</td>
              <td className="px-4 py-3 text-right text-gray-400 tabular-nums">Rs {item.rate.toLocaleString('en-PK')}</td>
              <td className="px-4 py-3 text-right text-white tabular-nums font-medium">Rs {item.lineTotal.toLocaleString('en-PK')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
