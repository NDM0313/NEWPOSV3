import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Loader2,
  Plus,
  Search,
  Calendar,
  Truck,
  CornerDownLeft,
  DollarSign,
  LayoutList,
  Package,
  MoreVertical,
  Share2,
  Clock3,
  Ban,
  Trash2,
  Edit3,
} from 'lucide-react';
import type { User, Branch } from '../../types';
import * as rentalsApi from '../../api/rentals';
import type { RentalListItem } from '../../api/rentals';
import { CreateRentalFlow } from './CreateRentalFlow';
import { RentalCalendarTab } from './RentalCalendarTab';
import { ViewRentalDetails, type RentalDetailInitialAction } from './ViewRentalDetails';
import { RentalWorkflowBadges } from './RentalWorkflowBadges';
import {
  rentalPrimaryStaffName,
  rentalShowCreatedBySecondary,
} from '../../lib/rentalWorkflowDisplay';
import { openWhatsAppShare } from '../../lib/phoneWhatsApp';
import { formatDate } from '../accounts/reports/_shared/format';
import { localNowDateString } from '../../utils/localDate';
import {
  DateRangeBar,
  makeInitialRange,
  type DateRangePreset,
  type DateRangeValue,
} from '../shared/DateRangeBar';
import { usePermissions } from '../../context/PermissionContext';
import { shouldScopeRentalsToOwnOnly } from '../../api/permissions';
import {
  resolveCounterListBranchScope,
  rowBelongsToRentalWorker,
  shouldIsolateCounterWorkerData,
} from '../../lib/counterDataIsolation';
import { rowInListBranchScope } from '../../lib/listBranchScope';
import {
  useEffectiveWorkerId,
  useEffectiveWorkerProfileId,
  useEffectiveWorkerRole,
} from '../../context/CounterWorkerContext';

type RentalTab = 'list' | 'calendar' | 'pickupToday' | 'returnToday' | 'collections';

const RENTAL_HIDDEN_DATE_PRESETS: DateRangePreset[] = [
  'yesterday',
  'last7',
  'last15',
  'month',
  'quarter',
  'year',
  'all',
];

function matchesRentalSearch(r: RentalListItem, q: string): boolean {
  if (!q) return true;
  const staff = rentalPrimaryStaffName(r.salesmanName, r.createdByName).toLowerCase();
  return (
    r.bookingNo.toLowerCase().includes(q) ||
    r.documentNumber.toLowerCase().includes(q) ||
    r.customer.toLowerCase().includes(q) ||
    r.status.toLowerCase().includes(q) ||
    staff.includes(q) ||
    (r.salesmanName?.toLowerCase().includes(q) ?? false) ||
    (r.createdByName?.toLowerCase().includes(q) ?? false)
  );
}

interface RentalModuleProps {
  onBack: () => void;
  user: User;
  companyId: string | null;
  branch: Branch | null;
  focusRentalId?: string | null;
  onFocusHandled?: () => void;
}


function RentalStaffLines({
  salesmanName,
  createdByName,
}: {
  salesmanName?: string | null;
  createdByName?: string | null;
}) {
  const primary = rentalPrimaryStaffName(salesmanName, createdByName);
  const showSecondary = rentalShowCreatedBySecondary(salesmanName, createdByName);
  return (
    <>
      <p className="text-xs text-[#9CA3AF] mt-0.5">
        Salesman: <span className="text-[#D1D5DB]">{primary}</span>
      </p>
      {showSecondary && createdByName ? (
        <p className="text-[10px] text-[#6B7280]">Created: {createdByName}</p>
      ) : null}
    </>
  );
}

export function RentalModule({
  onBack,
  user,
  companyId,
  branch,
  focusRentalId,
  onFocusHandled,
}: RentalModuleProps) {
  const effectiveUserId = useEffectiveWorkerId(user?.id ?? '');
  const effectiveProfileId = useEffectiveWorkerProfileId();
  const effectiveRole = useEffectiveWorkerRole(user?.role ?? 'admin');
  const { branchIds, isAdminOrOwner, permissions, isPermissionLoaded } = usePermissions();
  const isolateWorkerData = shouldIsolateCounterWorkerData(effectiveRole);
  const scopeRentalsToOwn = useMemo(
    () =>
      isPermissionLoaded
        ? shouldScopeRentalsToOwnOnly(permissions, isAdminOrOwner)
        : false,
    [isPermissionLoaded, permissions, isAdminOrOwner],
  );
  const listBranchScope = useMemo(
    () =>
      resolveCounterListBranchScope(branch?.id, branchIds, isAdminOrOwner, isolateWorkerData),
    [branch?.id, branchIds, isAdminOrOwner, isolateWorkerData],
  );

  const [showCreate, setShowCreate] = useState(false);
  const [list, setList] = useState<RentalListItem[]>([]);
  const [loading, setLoading] = useState(!!companyId);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menuRental, setMenuRental] = useState<RentalListItem | null>(null);
  const [activeTab, setActiveTab] = useState<RentalTab>('list');
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => makeInitialRange('last30'));
  const [detailAction, setDetailAction] = useState<RentalDetailInitialAction | null>(null);
  const [metaEditRental, setMetaEditRental] = useState<RentalListItem | null>(null);
  const [metaBillRef, setMetaBillRef] = useState('');
  const [metaSaving, setMetaSaving] = useState(false);
  const wasInChildView = useRef(false);

  useEffect(() => {
    if (!focusRentalId) return;
    setSelectedId(focusRentalId);
    onFocusHandled?.();
  }, [focusRentalId, onFocusHandled]);

  const rentalFetchOpts = useMemo(() => {
    const scopeToOwn =
      scopeRentalsToOwn || isolateWorkerData
        ? { authUserId: effectiveUserId, profileId: effectiveProfileId }
        : undefined;
    const base = {
      dateFrom: dateRange.from,
      dateTo: dateRange.to,
      scopeToOwn,
    };
    if (listBranchScope.mode === 'accessible') {
      return { ...base, accessibleBranchIds: listBranchScope.branchIds };
    }
    return base;
  }, [
    dateRange.from,
    dateRange.to,
    scopeRentalsToOwn,
    isolateWorkerData,
    effectiveUserId,
    effectiveProfileId,
    listBranchScope,
  ]);

  const apiBranchId =
    listBranchScope.mode === 'single' ? listBranchScope.branchId : branch?.id ?? null;

  const scopedList = useMemo(() => {
    let rows = list.filter((r) =>
      rowInListBranchScope({ branch_id: r.branchId }, listBranchScope),
    );
    if (scopeRentalsToOwn || isolateWorkerData) {
      rows = rows.filter((r) =>
        rowBelongsToRentalWorker(
          { created_by: r.createdBy, salesman_id: r.salesmanId },
          effectiveUserId,
          effectiveProfileId,
        ),
      );
    }
    return rows;
  }, [
    list,
    listBranchScope,
    scopeRentalsToOwn,
    isolateWorkerData,
    effectiveUserId,
    effectiveProfileId,
  ]);

  const refreshList = useCallback(() => {
    if (!companyId) return;
    rentalsApi.getRentals(companyId, apiBranchId, rentalFetchOpts).then(({ data, error }) => {
      if (!error && data) setList(data);
    });
  }, [companyId, apiBranchId, rentalFetchOpts]);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    let c = false;
    setLoading(true);
    rentalsApi.getRentals(companyId, apiBranchId, rentalFetchOpts).then(({ data, error }) => {
      if (c) return;
      setLoading(false);
      if (!error && data) setList(data);
    });
    return () => {
      c = true;
    };
  }, [companyId, apiBranchId, rentalFetchOpts]);

  // Refresh list when returning from detail or create so changes are visible
  useEffect(() => {
    if (selectedId || showCreate) wasInChildView.current = true;
    else if (wasInChildView.current && companyId) {
      wasInChildView.current = false;
      refreshList();
    }
  }, [selectedId, showCreate]);

  const today = localNowDateString();

  const searchQ = search.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!searchQ) return scopedList;
    return scopedList.filter((r) => matchesRentalSearch(r, searchQ));
  }, [scopedList, searchQ]);

  const applySearch = useCallback(
    (rows: RentalListItem[]) => {
      if (!searchQ) return rows;
      return rows.filter((r) => matchesRentalSearch(r, searchQ));
    },
    [searchQ]
  );

  const summary = useMemo(() => {
    const totalDue = scopedList.reduce((s, r) => s + r.due, 0);
    const active = scopedList.filter((r) => r.status === 'rented').length;
    const overdue = scopedList.filter((r) => r.status === 'overdue').length;
    const todayPickups = scopedList.filter((r) => r.pickup === today && r.status === 'booked').length;
    const todayReturns = scopedList.filter(
      (r) => (r.status === 'rented' || r.status === 'overdue') && r.return <= today
    ).length;
    return { totalDue, active, overdue, todayPickups, todayReturns };
  }, [scopedList, today]);

  const todayPickupsList = useMemo(
    () => applySearch(scopedList.filter((r) => r.pickup === today && r.status === 'booked')),
    [scopedList, today, applySearch]
  );

  const todayReturnsList = useMemo(
    () =>
      applySearch(
        scopedList
          .filter((r) => (r.status === 'rented' || r.status === 'overdue') && r.return <= today)
          .sort((a, b) => (a.return < b.return ? -1 : 1))
      ),
    [scopedList, today, applySearch]
  );

  const collectionsList = useMemo(
    () => applySearch(scopedList.filter((r) => r.due > 0).sort((a, b) => b.due - a.due)),
    [scopedList, applySearch]
  );

  const totalOutstanding = useMemo(() => collectionsList.reduce((s, r) => s + r.due, 0), [collectionsList]);

  const calendarFetchOpts = useMemo(
    () => ({
      accessibleBranchIds:
        listBranchScope.mode === 'accessible' ? listBranchScope.branchIds : undefined,
      scopeToOwn: rentalFetchOpts.scopeToOwn,
    }),
    [listBranchScope, rentalFetchOpts.scopeToOwn],
  );

  if (showCreate) {
    return (
      <CreateRentalFlow
        companyId={companyId}
        branchId={branch?.id ?? null}
        userId={effectiveUserId || null}
        userRole={user?.role}
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
        userId={effectiveUserId || null}
        initialAction={detailAction}
        onConsumedInitialAction={() => setDetailAction(null)}
        onBack={() => {
          setSelectedId(null);
          setDetailAction(null);
        }}
        onRefresh={refreshList}
      />
    );
  }

  const openMetaEdit = (r: RentalListItem) => {
    setMenuRental(null);
    setMetaEditRental(r);
    setMetaBillRef(r.documentNumber || '');
  };

  const saveMetaEdit = async () => {
    if (!metaEditRental) return;
    setMetaSaving(true);
    const { error: err } = await rentalsApi.updateRentalMeta(metaEditRental.id, {
      documentNumber: metaBillRef,
    });
    setMetaSaving(false);
    if (err) {
      alert(err);
      return;
    }
    setMetaEditRental(null);
    refreshList();
  };

  const tabButtons: { id: RentalTab; label: string; icon: React.ReactElement }[] = [
    { id: 'list', label: 'List', icon: <LayoutList className="w-4 h-4" /> },
    { id: 'calendar', label: 'Calendar', icon: <Calendar className="w-4 h-4" /> },
    { id: 'pickupToday', label: 'Pickup Today', icon: <Truck className="w-4 h-4" /> },
    { id: 'returnToday', label: 'Return Today', icon: <CornerDownLeft className="w-4 h-4" /> },
    { id: 'collections', label: 'Collections', icon: <DollarSign className="w-4 h-4" /> },
  ];

  const openDetailWithAction = (r: RentalListItem, action: RentalDetailInitialAction) => {
    setMenuRental(null);
    setDetailAction(action);
    setSelectedId(r.id);
  };

  const handleCancelRental = async (r: RentalListItem) => {
    if (!companyId || !window.confirm(`Cancel rental ${r.bookingNo}?`)) return;
    setMenuRental(null);
    const { error: err } = await rentalsApi.cancelRental(r.id, companyId);
    if (err) alert(err);
    else refreshList();
  };

  const handleDeleteRental = async (r: RentalListItem) => {
    if (!companyId || !window.confirm(`Delete rental ${r.bookingNo}? This cannot be undone.`)) return;
    setMenuRental(null);
    const { error: err } = await rentalsApi.deleteRental(r.id, companyId);
    if (err) alert(err);
    else refreshList();
  };

  const handleShareWhatsApp = (r: RentalListItem) => {
    setMenuRental(null);
    const text = [
      `Rental: ${r.bookingNo}`,
      r.documentNumber ? `Bill: ${r.documentNumber}` : '',
      `Customer: ${r.customer}`,
      `Pickup: ${formatDate(r.pickup)}`,
      `Return: ${formatDate(r.return)}`,
      `Total: Rs. ${r.total.toLocaleString()}`,
      `Due: Rs. ${r.due.toLocaleString()}`,
    ].join('\n');
    openWhatsAppShare(r.customerPhone, text);
  };

  const renderRentalCard = (r: RentalListItem, extra?: React.ReactNode) => {
    const isOverdue = (r.status === 'rented' || r.status === 'overdue') && r.return < today;
    return (
      <div
        key={r.id}
        className={`relative w-full text-left bg-[#1F2937] border rounded-xl p-4 hover:border-[#8B5CF6]/50 transition-colors ${isOverdue ? 'border-[#EF4444]/50' : 'border-[#374151]'}`}
      >
        <button type="button" onClick={() => setSelectedId(r.id)} className="w-full text-left pr-10">
          <div className="flex justify-between items-start gap-3">
            <div>
              <p className="font-medium text-white">{r.bookingNo}</p>
              {r.documentNumber ? (
                <p className="text-xs text-[#8B5CF6]/90">Bill: {r.documentNumber}</p>
              ) : null}
              <p className="text-sm text-[#9CA3AF]">{r.customer}</p>
              <RentalStaffLines salesmanName={r.salesmanName} createdByName={r.createdByName} />
              <div className="mt-1 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-[#374151] text-[#D1D5DB]">
                  <Calendar className="w-3.5 h-3.5" /> Pickup: {formatDate(r.pickup)}
                </span>
                <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ${isOverdue ? 'bg-[#EF4444]/20 text-[#FCA5A5]' : 'bg-[#374151] text-[#D1D5DB]'}`}>
                  <Clock3 className="w-3.5 h-3.5" /> Return: {formatDate(r.return)}
                </span>
              </div>
              {extra}
              <RentalWorkflowBadges status={isOverdue ? 'overdue' : r.status} due={r.due} compact className="mt-2" />
            </div>
            <div className="text-right shrink-0">
              <p className="text-[#8B5CF6] font-semibold">Rs. {r.total.toLocaleString()}</p>
              <p className="text-xs text-[#9CA3AF]">Paid: Rs. {r.paid.toLocaleString()}</p>
              {r.due > 0 && (
                <p className="text-xs text-[#F59E0B]">Due: Rs. {r.due.toLocaleString()}</p>
              )}
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setMenuRental(menuRental?.id === r.id ? null : r)}
          className="absolute top-3 right-3 p-2 hover:bg-[#374151] rounded-lg text-[#9CA3AF]"
          aria-label="More options"
        >
          <MoreVertical className="w-5 h-5" />
        </button>
        {menuRental?.id === r.id && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setMenuRental(null)}>
            <div className="bg-[#1F2937] border border-[#374151] rounded-2xl shadow-xl overflow-hidden w-full max-w-[280px]" onClick={(e) => e.stopPropagation()}>
              <div className="px-4 py-3 border-b border-[#374151]">
                <p className="text-sm font-medium text-[#9CA3AF]">{r.bookingNo}</p>
                {r.documentNumber ? <p className="text-xs text-[#8B5CF6]">Bill: {r.documentNumber}</p> : null}
                <p className="text-xs text-[#D1D5DB]">{r.customer}</p>
                <p className="text-[10px] text-[#6B7280]">
                  Salesman: {rentalPrimaryStaffName(r.salesmanName, r.createdByName)}
                </p>
              </div>
              <div className="py-2">
                <button onClick={() => { setMenuRental(null); setSelectedId(r.id); }} className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-[#374151]">
                  <LayoutList className="w-5 h-5 text-[#3B82F6]" /> View Details
                </button>
                {r.status === 'booked' && (
                  <button onClick={() => openDetailWithAction(r, 'pickup')} className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-[#374151]">
                    <Truck className="w-5 h-5 text-blue-400" /> Mark Picked Up
                  </button>
                )}
                {(r.status === 'rented' || r.status === 'overdue') && (
                  <button onClick={() => openDetailWithAction(r, 'return')} className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-[#374151]">
                    <CornerDownLeft className="w-5 h-5 text-[#10B981]" /> Receive Return
                  </button>
                )}
                {r.due > 0 && (
                  <button onClick={() => openDetailWithAction(r, 'payment')} className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-[#374151]">
                    <DollarSign className="w-5 h-5 text-[#10B981]" /> Add Payment
                  </button>
                )}
                {(r.status === 'booked' || r.status === 'draft') && (
                  <button onClick={() => openMetaEdit(r)} className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-[#374151]">
                    <Edit3 className="w-5 h-5 text-amber-400" /> Edit Bill Ref
                  </button>
                )}
                {(r.status === 'booked' || r.status === 'draft') && (
                  <button onClick={() => void handleCancelRental(r)} className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-[#374151]">
                    <Ban className="w-5 h-5 text-[#F59E0B]" /> Cancel
                  </button>
                )}
                {(r.status === 'booked' || r.status === 'draft') && (
                  <button onClick={() => void handleDeleteRental(r)} className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-[#374151]">
                    <Trash2 className="w-5 h-5 text-red-400" /> Delete
                  </button>
                )}
                <button onClick={() => handleShareWhatsApp(r)} className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-[#374151]">
                  <Share2 className="w-5 h-5 text-[#10B981]" /> Share via WhatsApp
                </button>
              </div>
              <button onClick={() => setMenuRental(null)} className="w-full py-3 text-sm text-[#9CA3AF] border-t border-[#374151] hover:bg-[#374151]">
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] p-4 sticky top-0 z-10 flow-screen-header">
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
        <div className="flex items-center gap-1 p-1 bg-white/10 rounded-xl border border-white/20 mb-3 overflow-x-auto scrollbar-hide">
          {tabButtons.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-none flex items-center justify-center gap-1.5 min-w-0 py-2.5 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
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

        {/* Date range — list / pickup / return / collections */}
        {activeTab !== 'calendar' && (
          <div className="mb-2">
            <DateRangeBar
              value={dateRange}
              onChange={setDateRange}
              variant="purple"
              hidePresets={RENTAL_HIDDEN_DATE_PRESETS}
            />
          </div>
        )}

        {activeTab !== 'calendar' && (
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/70" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search booking, bill ref, customer…"
            className="w-full h-10 bg-white/10 border border-white/20 rounded-lg pl-10 pr-3 text-white placeholder-white/60 text-sm focus:outline-none focus:ring-2 focus:ring-white/30"
          />
        </div>
        )}

        {/* Summary cards - only on List tab (web-style) */}
        {activeTab === 'list' && !loading && scopedList.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
              <p className="text-xs text-white/70 mb-1">Total</p>
              <p className="text-lg font-bold text-white">{scopedList.length}</p>
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

      <div className={activeTab === 'calendar' ? 'px-3 pb-3 pt-0' : 'p-4 space-y-3'}>
        {activeTab === 'calendar' ? (
          <RentalCalendarTab
            companyId={companyId}
            apiBranchId={apiBranchId}
            fetchOpts={calendarFetchOpts}
            listBranchScope={listBranchScope}
            scopeRentalsToOwn={scopeRentalsToOwn}
            isolateWorkerData={isolateWorkerData}
            effectiveUserId={effectiveUserId}
            effectiveProfileId={effectiveProfileId ?? undefined}
            onSelectRentalId={(id) => setSelectedId(id)}
          />
        ) : loading ? (
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

      {metaEditRental && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/60">
          <div className="bg-[#1F2937] border border-[#374151] rounded-2xl w-full max-w-md p-4 space-y-3">
            <h3 className="text-white font-medium">Edit bill reference</h3>
            <p className="text-xs text-[#9CA3AF]">{metaEditRental.bookingNo}</p>
            <input
              type="text"
              value={metaBillRef}
              onChange={(e) => setMetaBillRef(e.target.value)}
              placeholder="Manual bill / ref #"
              className="w-full h-10 bg-[#111827] border border-[#374151] rounded-lg px-3 text-white text-sm"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMetaEditRental(null)}
                className="flex-1 py-2.5 border border-[#374151] rounded-lg text-[#9CA3AF]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={metaSaving}
                onClick={() => void saveMetaEdit()}
                className="flex-1 py-2.5 bg-[#8B5CF6] rounded-lg text-white font-medium disabled:opacity-50"
              >
                {metaSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
