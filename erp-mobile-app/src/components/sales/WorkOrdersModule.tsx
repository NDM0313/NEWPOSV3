import { useState } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import type { User } from '../../types';
import { useEffectiveWorkerId } from '../../context/CounterWorkerContext';
import { WorkOrdersList } from './WorkOrdersList';

interface WorkOrdersModuleProps {
  onBack: () => void;
  user: User;
  companyId: string | null;
  branchId: string | null;
}

export function WorkOrdersModule({ onBack, user, companyId, branchId }: WorkOrdersModuleProps) {
  const effectiveUserId = useEffectiveWorkerId(user.id);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <div className="bg-gradient-to-br from-[#5B21B6] via-[#7C3AED] to-[#8B5CF6] p-4 sticky top-0 z-10 flow-screen-header shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <button
            type="button"
            onClick={onBack}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-white text-lg">Work Orders</h1>
            <p className="text-xs text-white/80">Bespoke production jobs</p>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search WO #, worker, sale…"
            className="w-full h-10 bg-white/15 border border-white/20 rounded-xl pl-10 pr-4 text-sm text-white placeholder:text-white/60 focus:outline-none focus:bg-white/20 focus:border-white/40"
          />
        </div>
      </div>

      <div className="p-4">
        {!companyId ? (
          <p className="text-sm text-gray-500 text-center py-8">Company not loaded</p>
        ) : (
          <WorkOrdersList
            companyId={companyId}
            branchId={branchId === 'all' ? null : branchId}
            userId={effectiveUserId}
            searchQuery={searchQuery}
          />
        )}
      </div>
    </div>
  );
}
