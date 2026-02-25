import { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, Loader2, Plus, Search, Calendar, Truck, CornerDownLeft, DollarSign, LayoutList, Package } from 'lucide-react';
import type { User, Branch } from '../../types';
import * as rentalsApi from '../../api/rentals';
import type { RentalListItem } from '../../api/rentals';
import { CreateRentalFlow } from './CreateRentalFlow';
import { ViewRentalDetails } from './ViewRentalDetails';

type RentalTab = 'list' | 'pickupToday' | 'returnToday' | 'collections';

interface RentalModuleProps {
  onBack: () => void;
  user: User;
  companyId: string | null;
  branch: Branch | null;
}

const STATUS_CLASS: Record<string, string> = {
  draft: 'bg-[#6B7280]/30 text-[#9CA3AF]',
  booked: 'bg-pink-500/20 text-pink-400 border border-pink-500/30',
  rented: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  returned: 'bg-green-500/20 text-green-400 border border-green-500/30',
  overdue: 'bg-red-500/20 text-red-400 border border-red-500/30',
  cancelled: 'bg-[#6B7280]/30 text-[#9CA3AF]',
};

export function RentalModule({ onBack, user, companyId, branch }: RentalModuleProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [list, setList] = useState<RentalListItem[]>([]);
  const [loading, setLoading] = useState(!!companyId);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<RentalTab>('list');
  const wasInChildView = useRef(false);

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

  // Refresh list when returning from detail or create so changes are visible
  useEffect(() => {
    if (selectedId || showCreate) wasInChildView.current = true;
    else if (wasInChildView.current && companyId) {
      wasInChildView.current = false;
      refreshList();
    }
  }, [selectedId, showCreate]);

  const today = new Date().toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    if (!search.trim()) return list;
    const q = search.toLowerCase().trim();
    return list.filter(
      (r) =>
        r.no.toLowerCase().includes(q) ||
        r.customer.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q)
    );
  }, [list, search]);

  const summary = useMemo(() => {
    const totalDue = list.reduce((s, r) => s + r.due, 0);
    const active = list.filter((r) => r.status === 'rented').length;
    const overdue = list.filter((r) => r.status === 'overdue').length;
    const todayPickups = list.filter((r) => r.pickup === today && r.status === 'booked').length;
    const todayReturns = list.filter(
      (r) => (r.status === 'rented' || r.status === 'overdue') && r.return <= today
    ).length;
    return { totalDue, active, overdue, todayPickups, todayReturns };
  }, [list, today]);

  const todayPickupsList = useMemo(
    () => list.filter((r) => r.pickup === today && r.status === 'booked'),
    [list, today]
  );

  const todayReturnsList = useMemo(
    () =>
      list
        .filter((r) => (r.status === 'rented' || r.status === 'overdue') && r.return <= today)
        .sort((a, b) => (a.return < b.return ? -1 : 1)),
    [list, today]
  );

  const collectionsList = useMemo(
    () => list.filter((r) => r.due > 0).sort((a, b) => b.due - a.due),
    [list]
  );

  const totalOutstanding = useMemo(() => collectionsList.reduce((s, r) => s + r.due, 0), [collectionsList]);

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

  if (selectedId) {
    return (
      <ViewRentalDetails
        rentalId={selectedId}
        companyId={companyId}
        userId={user?.id ?? null}
        onBack={() => setSelectedId(null)}
        onRefresh={refreshList}
      />
    );
  }

  const tabButtons: { id: RentalTab; label: string; icon: React.ReactElement }[] = [
    { id: 'list', label: 'List', icon: <LayoutList className="w-4 h-4" /> },
    { id: 'pickupToday', label: 'Pickup Today', icon: <Truck className="w-4 h-4" /> },
    { id: 'returnToday', label: 'Return Today', icon: <CornerDownLeft className="w-4 h-4" /> },
    { id: 'collections', label: 'Collections', icon: <DollarSign className="w-4 h-4" /> },
  ];

  const renderRentalCard = (r: RentalListItem, extra?: React.ReactNode) => (
    <button
      key={r.id}
      type="button"
      onClick={() => setSelectedId(r.id)}
      className="w-full text-left bg-[#1F2937] border border-[#374151] rounded-xl p-4 hover:border-[#8B5CF6]/50 transition-colors"
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="font-medium text-white">{r.no}</p>
          <p className="text-sm text-[#9CA3AF]">{r.customer}</p>
          <p className="text-xs text-[#6B7280] mt-0.5">
            <Calendar className="w-3.5 h-3.5 inline mr-1" />
            {r.pickup} → {r.return}
          </p>
          {extra}
          <span
            className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium capitalize ${STATUS_CLASS[r.status] ?? 'bg-[#374151] text-[#9CA3AF]'}`}
          >
            {r.status}
          </span>
        </div>
        <div className="text-right">
          <p className="text-[#8B5CF6] font-semibold">Rs. {r.total.toLocaleString()}</p>
          <p className="text-xs text-[#9CA3AF]">Paid: Rs. {r.paid.toLocaleString()}</p>
          {r.due > 0 && (
            <p className="text-xs text-[#F59E0B]">Due: Rs. {r.due.toLocaleString()}</p>
          )}
        </div>
      </div>
    </button>
  );

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-white">Rentals</h1>
              <p className="text-xs text-white/80">Manage bookings & returns</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-3 py-2.5 bg-white text-[#7C3AED] hover:bg-white/90 rounded-lg font-medium text-sm shadow-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add
          </button>
        </div>

        {/* Tabs (web RentalDashboard style) */}
        <div className="flex items-center gap-1 p-1 bg-white/10 rounded-xl border border-white/20 mb-3">
          {tabButtons.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 min-w-0 py-2.5 px-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id ? 'bg-white text-[#7C3AED] shadow' : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              <span className="shrink-0">{tab.icon}</span>
              <span className="truncate">{tab.label}</span>
              {tab.id === 'pickupToday' && summary.todayPickups > 0 && (
                <span className={`shrink-0 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-xs font-bold ${activeTab === tab.id ? 'bg-[#7C3AED]/20 text-[#7C3AED]' : 'bg-white/20 text-white'}`}>
                  {summary.todayPickups}
                </span>
              )}
              {tab.id === 'returnToday' && summary.todayReturns > 0 && (
                <span className={`shrink-0 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-xs font-bold ${activeTab === tab.id ? 'bg-[#7C3AED]/20 text-[#7C3AED]' : 'bg-white/20 text-white'}`}>
                  {summary.todayReturns}
                </span>
              )}
              {tab.id === 'collections' && collectionsList.length > 0 && (
                <span className={`shrink-0 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-xs font-bold ${activeTab === tab.id ? 'bg-[#7C3AED]/20 text-[#7C3AED]' : 'bg-white/20 text-white'}`}>
                  {collectionsList.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search - only on List tab */}
        {activeTab === 'list' && (
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/70" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by number, customer…"
              className="w-full h-10 bg-white/10 border border-white/20 rounded-lg pl-10 pr-3 text-white placeholder-white/60 text-sm focus:outline-none focus:ring-2 focus:ring-white/30"
            />
          </div>
        )}

        {/* Summary cards - only on List tab (web-style) */}
        {activeTab === 'list' && !loading && list.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
              <p className="text-xs text-white/70 mb-1">Total</p>
              <p className="text-lg font-bold text-white">{list.length}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
              <p className="text-xs text-white/70 mb-1">Outstanding</p>
              <p className="text-lg font-bold text-white">Rs. {summary.totalDue.toLocaleString()}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
              <p className="text-xs text-white/70 mb-1 flex items-center gap-1">
                <Truck className="w-3.5 h-3.5" /> Today pickups
              </p>
              <p className="text-lg font-bold text-white">{summary.todayPickups}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
              <p className="text-xs text-white/70 mb-1 flex items-center gap-1">
                <CornerDownLeft className="w-3.5 h-3.5" /> Today returns
              </p>
              <p className="text-lg font-bold text-white">{summary.todayReturns}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
              <p className="text-xs text-white/70 mb-1">Active</p>
              <p className="text-lg font-bold text-blue-200">{summary.active}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
              <p className="text-xs text-white/70 mb-1">Overdue</p>
              <p className="text-lg font-bold text-red-200">{summary.overdue}</p>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#8B5CF6] animate-spin" />
          </div>
        ) : activeTab === 'list' ? (
          filtered.length === 0 ? (
            <p className="text-[#9CA3AF] text-center py-8">
              {search ? 'No rentals match your search.' : 'No rentals yet.'}
            </p>
          ) : (
            filtered.map((r) => renderRentalCard(r))
          )
        ) : activeTab === 'pickupToday' ? (
          todayPickupsList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[#9CA3AF]">
              <Package className="w-12 h-12 mb-3 opacity-50" />
              <p className="font-medium">No pickups today</p>
              <p className="text-sm mt-1">Rentals scheduled for today are already processed or none scheduled</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-white/80 mb-2">
                Rentals scheduled for pickup today ({todayPickupsList.length}). Tap to open and mark as picked up.
              </p>
              {todayPickupsList.map((r) => renderRentalCard(r, <span className="block mt-1 text-xs text-pink-300">Booked · Process pickup</span>))}
            </>
          )
        ) : activeTab === 'returnToday' ? (
          todayReturnsList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[#9CA3AF]">
              <Package className="w-12 h-12 mb-3 opacity-50" />
              <p className="font-medium">No returns due today</p>
              <p className="text-sm mt-1">Rentals due or overdue are already processed or none due</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-white/80 mb-2">
                Due or overdue for return ({todayReturnsList.length}). Tap to open and receive return.
              </p>
              {todayReturnsList.map((r) => renderRentalCard(r))}
            </>
          )
        ) : (
          /* collections */
          collectionsList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[#9CA3AF]">
              <DollarSign className="w-12 h-12 mb-3 opacity-50" />
              <p className="font-medium">No outstanding balance</p>
              <p className="text-sm mt-1">All rentals are fully paid</p>
            </div>
          ) : (
            <>
              <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 mb-4">
                <p className="text-xs text-[#9CA3AF] mb-1">Total outstanding</p>
                <p className="text-xl font-bold text-[#F59E0B]">Rs. {totalOutstanding.toLocaleString()}</p>
                <p className="text-xs text-[#6B7280] mt-1">{collectionsList.length} rental(s) with balance due</p>
              </div>
              <p className="text-sm text-white/80 mb-2">Tap a rental to add payment.</p>
              {collectionsList.map((r) => renderRentalCard(r))}
            </>
          )
        )}
      </div>
    </div>
  );
}
