import { ArrowLeft, Plus, TrendingUp } from 'lucide-react';

interface SalesHomeProps {
  onBack: () => void;
  onNewSale: () => void;
}

const recentSales = [
  { id: 'INV-0045', customer: 'Ahmed', amount: 12000, date: 'Today, 2:30 PM' },
  { id: 'INV-0044', customer: 'Sara', amount: 8500, date: 'Today, 11:15 AM' },
  { id: 'INV-0043', customer: 'Ali', amount: 15200, date: 'Yesterday, 4:20 PM' },
  { id: 'INV-0042', customer: 'Fatima', amount: 22000, date: 'Yesterday, 1:45 PM' },
];

export function SalesHome({ onBack, onNewSale }: SalesHomeProps) {
  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <div className="bg-[#1F2937] border-b border-[#374151] px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg transition-colors active:scale-95 text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-white">Sales</h1>
        </div>
        <button onClick={onNewSale} className="p-2 bg-[#3B82F6] hover:bg-[#2563EB] rounded-lg transition-colors active:scale-95 text-white">
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4">
        <div className="bg-gradient-to-br from-[#3B82F6] to-[#2563EB] rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-white/80" />
            <span className="text-sm text-white/80">Quick Stats</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-white/60 mb-1">Today</p>
              <p className="text-2xl font-bold text-white">Rs. 45,000</p>
            </div>
            <div>
              <p className="text-xs text-white/60 mb-1">This Week</p>
              <p className="text-2xl font-bold text-white">Rs. 320,000</p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-medium text-[#9CA3AF] mb-3">RECENT SALES</h2>
          <div className="space-y-2">
            {recentSales.map((sale) => (
              <button
                key={sale.id}
                className="w-full bg-[#1F2937] border border-[#374151] rounded-xl p-4 hover:border-[#3B82F6] transition-colors text-left active:scale-[0.98]"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-white">{sale.id}</span>
                  <span className="text-sm font-semibold text-[#10B981]">Rs. {sale.amount.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#9CA3AF]">{sale.customer}</span>
                  <span className="text-xs text-[#6B7280]">{sale.date}</span>
                </div>
              </button>
            ))}
          </div>
          <button className="w-full mt-4 py-3 border border-[#374151] rounded-lg text-sm text-[#9CA3AF] hover:bg-[#1F2937] transition-colors">
            Load More
          </button>
        </div>
      </div>

      <button
        onClick={onNewSale}
        className="fixed bottom-24 right-6 w-14 h-14 bg-[#3B82F6] hover:bg-[#2563EB] rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-all text-white z-20"
        aria-label="New sale"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}
