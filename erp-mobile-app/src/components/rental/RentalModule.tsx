import { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, Plus } from 'lucide-react';
import type { User, Branch } from '../../types';
import * as rentalsApi from '../../api/rentals';
import { CreateRentalFlow } from './CreateRentalFlow';

interface RentalModuleProps {
  onBack: () => void;
  user: User;
  companyId: string | null;
  branch: Branch | null;
}

export function RentalModule({ onBack, user, companyId, branch }: RentalModuleProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [list, setList] = useState<{ id: string; no: string; customer: string; pickup: string; return: string; status: string; total: number; paid: number; due: number }[]>([]);
  const [loading, setLoading] = useState(!!companyId);

  const refreshList = () => {
    if (!companyId) return;
    rentalsApi.getRentals(companyId, branch?.id).then(({ data, error }) => {
      if (!error && data) setList(data);
    });
  };

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    let c = false;
    setLoading(true);
    rentalsApi.getRentals(companyId, branch?.id).then(({ data, error }) => {
      if (c) return;
      setLoading(false);
      if (!error && data) setList(data);
    });
    return () => { c = true; };
  }, [companyId, branch?.id]);

  if (showCreate) {
    return (
      <CreateRentalFlow
        companyId={companyId}
        branchId={branch?.id ?? null}
        userId={user?.id ?? null}
        onBack={() => setShowCreate(false)}
        onSuccess={() => {
          setShowCreate(false);
          refreshList();
        }}
      />
    );
  }

  const totalDue = list.reduce((s, r) => s + r.due, 0);

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-white">Rentals</h1>
              <p className="text-xs text-white/80">Manage bookings & returns</p>
            </div>
          </div>
          {branch?.id !== 'all' && (
            <button onClick={() => setShowCreate(true)} className="p-2.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-white flex items-center gap-2">
              <Plus className="w-5 h-5" />
              <span className="text-sm font-medium">New Booking</span>
            </button>
          )}
        </div>
        {!loading && list.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
              <p className="text-xs text-white/70 mb-1">Total Rentals</p>
              <p className="text-lg font-bold text-white">{list.length}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
              <p className="text-xs text-white/70 mb-1">Outstanding</p>
              <p className="text-lg font-bold text-white">Rs. {totalDue.toLocaleString()}</p>
            </div>
          </div>
        )}
      </div>
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#8B5CF6] animate-spin" />
          </div>
        ) : list.length === 0 ? (
          <p className="text-[#9CA3AF] text-center py-8">No rentals yet.</p>
        ) : (
          list.map((r) => (
            <div key={r.id} className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-white">{r.no}</p>
                  <p className="text-sm text-[#9CA3AF]">{r.customer}</p>
                  <p className="text-xs text-[#6B7280]">{r.pickup} → {r.return}</p>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs bg-[#374151] text-[#9CA3AF]">{r.status}</span>
                </div>
                <div className="text-right">
                  <p className="text-[#8B5CF6] font-semibold">Rs. {r.total.toLocaleString()}</p>
                  <p className="text-xs text-[#9CA3AF]">Paid: Rs. {r.paid.toLocaleString()}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
