import { useState } from 'react';
import { ArrowLeft, Shirt, Search } from 'lucide-react';
import { User } from '../../App';
import { DateRangeSelector } from './DateRangeSelector';

interface RentalReportsProps {
  onBack: () => void;
  user: User;
}

interface Rental {
  id: string;
  customer: string;
  item: string;
  startDate: string;
  returnDate: string;
  amount: number;
  status: 'active' | 'returned' | 'overdue';
}

export function RentalReports({ onBack, user }: RentalReportsProps) {
  const [filter, setFilter] = useState<'all' | 'active' | 'overdue' | 'returned'>('all');
  const [dateFrom, setDateFrom] = useState('2026-01-01');
  const [dateTo, setDateTo] = useState('2026-01-30');

  const handleDateChange = (from: string, to: string) => {
    setDateFrom(from);
    setDateTo(to);
  };

  const rentals: Rental[] = [
    { id: 'r1', customer: 'Sara Ahmed', item: 'Bridal Dress', startDate: '2026-01-15', returnDate: '2026-01-22', amount: 25000, status: 'active' },
    { id: 'r2', customer: 'Ayesha Khan', item: 'Party Wear', startDate: '2026-01-10', returnDate: '2026-01-18', amount: 15000, status: 'overdue' },
    { id: 'r3', customer: 'Zara Ali', item: 'Formal Suit', startDate: '2026-01-05', returnDate: '2026-01-12', amount: 12000, status: 'returned' },
  ];

  const filtered = filter === 'all' ? rentals : rentals.filter(r => r.status === filter);

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <div className="bg-[#1F2937] border-b border-[#374151] px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg transition-colors active:scale-95">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Shirt className="w-6 h-6 text-[#8B5CF6]" />
            <h1 className="text-lg font-semibold">Rental Reports</h1>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <DateRangeSelector
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateChange={handleDateChange}
        />

        <div className="grid grid-cols-4 gap-2">
          {(['all', 'active', 'overdue', 'returned'] as const).map(status => (
            <button key={status} onClick={() => setFilter(status)} className={`h-10 ${filter === status ? 'bg-[#8B5CF6] text-white' : 'bg-[#1F2937] border border-[#374151] text-[#9CA3AF]'} rounded-lg text-xs font-medium transition-colors capitalize`}>
              {status}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filtered.map((rental) => (
            <div key={rental.id} className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-medium text-white">{rental.customer}</p>
                  <p className="text-xs text-[#9CA3AF]">{rental.item}</p>
                </div>
                <p className="text-sm font-bold text-[#8B5CF6]">Rs. {rental.amount.toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 ${rental.status === 'active' ? 'bg-[#3B82F6]/10 text-[#3B82F6]' : rental.status === 'overdue' ? 'bg-[#EF4444]/10 text-[#EF4444]' : 'bg-[#10B981]/10 text-[#10B981]'} text-xs rounded-md font-medium`}>
                  {rental.status}
                </span>
                <span className="text-xs text-[#6B7280]">{rental.startDate} to {rental.returnDate}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}