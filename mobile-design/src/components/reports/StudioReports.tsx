import { useState } from 'react';
import { ArrowLeft, Camera } from 'lucide-react';
import { User } from '../../App';
import { DateRangeSelector } from './DateRangeSelector';

interface StudioReportsProps {
  onBack: () => void;
  user: User;
}

interface StudioOrder {
  id: string;
  customer: string;
  item: string;
  currentStage: string;
  totalStages: number;
  completedStages: number;
  amount: number;
  status: 'in-progress' | 'completed' | 'pending';
}

export function StudioReports({ onBack, user }: StudioReportsProps) {
  const [dateFrom, setDateFrom] = useState('2026-01-01');
  const [dateTo, setDateTo] = useState('2026-01-30');

  const handleDateChange = (from: string, to: string) => {
    setDateFrom(from);
    setDateTo(to);
  };

  const orders: StudioOrder[] = [
    { id: 'st1', customer: 'Ayesha Bridal', item: 'Wedding Dress', currentStage: 'Stitching', totalStages: 5, completedStages: 2, amount: 85000, status: 'in-progress' },
    { id: 'st2', customer: 'Sara Collections', item: 'Party Wear Set', currentStage: 'Finishing', totalStages: 5, completedStages: 4, amount: 45000, status: 'in-progress' },
    { id: 'st3', customer: 'Zara Fashion', item: 'Formal Suit', currentStage: 'Completed', totalStages: 5, completedStages: 5, amount: 35000, status: 'completed' },
  ];

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <div className="bg-[#1F2937] border-b border-[#374151] px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg transition-colors active:scale-95">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Camera className="w-6 h-6 text-[#EC4899]" />
            <h1 className="text-lg font-semibold">Studio Reports</h1>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <DateRangeSelector
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateChange={handleDateChange}
        />
        {orders.map((order) => {
          const progress = (order.completedStages / order.totalStages) * 100;
          return (
            <div key={order.id} className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-medium text-white">{order.customer}</p>
                  <p className="text-xs text-[#9CA3AF]">{order.item}</p>
                </div>
                <p className="text-sm font-bold text-[#EC4899]">Rs. {order.amount.toLocaleString()}</p>
              </div>
              <div className="mb-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[#9CA3AF]">{order.currentStage}</span>
                  <span className="text-xs text-[#9CA3AF]">{order.completedStages}/{order.totalStages}</span>
                </div>
                <div className="h-2 bg-[#374151] rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#EC4899] to-[#8B5CF6] transition-all" style={{ width: `${progress}%` }}></div>
                </div>
              </div>
              <span className={`inline-block px-2 py-1 ${order.status === 'completed' ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-[#F59E0B]/10 text-[#F59E0B]'} text-xs rounded-md font-medium`}>
                {order.status}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}