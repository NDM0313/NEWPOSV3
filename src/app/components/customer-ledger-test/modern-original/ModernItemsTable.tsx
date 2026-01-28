import type { InvoiceItem } from '../../types/index';

interface ModernItemsTableProps {
  items: InvoiceItem[];
}

export function ModernItemsTable({ items }: ModernItemsTableProps) {
  // Safety check for undefined or empty items
  if (!items || items.length === 0) {
    return (
      <div className="p-4 text-center text-slate-500 text-sm">
        No items found
      </div>
    );
  }

  return (
    <div className="p-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="px-4 py-3 text-left text-xs text-slate-600 bg-slate-50">Item Name</th>
            <th className="px-4 py-3 text-right text-xs text-slate-600 bg-slate-50">Qty</th>
            <th className="px-4 py-3 text-right text-xs text-slate-600 bg-slate-50">Rate</th>
            <th className="px-4 py-3 text-right text-xs text-slate-600 bg-slate-50">Line Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr
              key={index}
              className="border-b border-slate-100 hover:bg-white transition-colors"
            >
              <td className="px-4 py-3 text-slate-700">{item.itemName}</td>
              <td className="px-4 py-3 text-right text-slate-900 tabular-nums">
                {item.qty}
              </td>
              <td className="px-4 py-3 text-right text-slate-900 tabular-nums">
                Rs {item.rate.toLocaleString('en-PK')}
              </td>
              <td className="px-4 py-3 text-right text-slate-900 tabular-nums">
                Rs {item.lineTotal.toLocaleString('en-PK')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}