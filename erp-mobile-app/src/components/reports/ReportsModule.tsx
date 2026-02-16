import { ArrowLeft, TrendingUp, FileText, DollarSign, Package, BarChart3, ShoppingBag } from 'lucide-react';

interface ReportsModuleProps {
  onBack: () => void;
}

const SECTIONS = [
  { id: 'sales', title: 'Sales Summary', desc: 'Daily, weekly, monthly sales', icon: DollarSign, color: '#3B82F6' },
  { id: 'purchase', title: 'Purchase Summary', desc: 'Vendor-wise purchase reports', icon: ShoppingBag, color: '#10B981' },
  { id: 'inventory', title: 'Inventory Report', desc: 'Stock levels, low stock alerts', icon: Package, color: '#F59E0B' },
  { id: 'profit', title: 'Profit & Loss', desc: 'Revenue, costs, margin', icon: BarChart3, color: '#8B5CF6' },
];

export function ReportsModule({ onBack }: ReportsModuleProps) {
  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 bg-[#8B5CF6] rounded-lg flex items-center justify-center">
              <TrendingUp size={18} className="text-white" />
            </div>
            <h1 className="text-white font-semibold text-base">Reports</h1>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3">
            <FileText className="w-10 h-10 text-[#8B5CF6]" />
            <div>
              <p className="font-medium text-white">Report types</p>
              <p className="text-sm text-[#9CA3AF]">Select a report to view (coming soon)</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.id}
                className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 flex items-center gap-4 opacity-90"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${s.color}20` }}>
                  <Icon className="w-6 h-6" style={{ color: s.color }} />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-white">{s.title}</h3>
                  <p className="text-sm text-[#9CA3AF]">{s.desc}</p>
                </div>
                <span className="text-xs px-2 py-1 rounded bg-[#374151] text-[#9CA3AF]">Soon</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
