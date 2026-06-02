import { useState, useEffect, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react';
import * as rentalsApi from '../../api/rentals';
import type { GetRentalsOptions, RentalCalendarRental } from '../../api/rentals';
import { getRentalProducts } from '../../api/products';
import {
  addDays,
  bookingOverlapsDay,
  differenceInDays,
  eachDayOfInterval,
  endOfMonth,
  formatDayHeader,
  formatMonthYear,
  formatYmdLong,
  isSameDay,
  parseYmd,
  startOfMonth,
  startOfWeek,
} from '../../utils/calendarGrid';
import type { ListBranchScope } from '../../lib/listBranchScope';
import { rowInListBranchScope } from '../../lib/listBranchScope';
import { rowBelongsToRentalWorker } from '../../lib/counterDataIsolation';
import {
  buildCalendarBookings,
  buildProductsForRows,
  CALENDAR_STATUS_COLORS,
  CALENDAR_STATUS_PILL,
  type CalendarBooking,
} from './rentalCalendarBookings';

type ViewMode = 'weekly' | 'monthly';
type DisplayMode = 'agenda' | 'board';

export interface RentalCalendarTabProps {
  companyId: string | null;
  apiBranchId: string | null | undefined;
  fetchOpts: Pick<GetRentalsOptions, 'accessibleBranchIds' | 'scopeToOwn'>;
  listBranchScope: ListBranchScope;
  scopeRentalsToOwn: boolean;
  isolateWorkerData: boolean;
  effectiveUserId: string;
  effectiveProfileId: string | undefined;
  onSelectRentalId: (id: string) => void;
}

function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
}

function BookingSheet({
  booking,
  onClose,
  onViewFull,
}: {
  booking: CalendarBooking;
  onClose: () => void;
  onViewFull: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#1F2937] border border-[#374151] rounded-t-2xl p-4 pb-8 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-[#8B5CF6] to-pink-500 flex items-center justify-center font-bold text-lg text-white shrink-0">
              {(booking.customer || '?').charAt(0)}
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-white truncate">{booking.customer}</h4>
              <p className="text-xs text-[#9CA3AF] capitalize mt-0.5">{booking.status}</p>
              {booking.isTodayReturn && (
                <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                  Returns today
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[#9CA3AF] hover:text-white rounded-lg"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-2 text-sm mb-4">
          <div className="flex justify-between">
            <span className="text-[#9CA3AF]">Product</span>
            <span className="text-white truncate ml-4">{booking.productName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#9CA3AF]">Pickup</span>
            <span className="text-white">{formatYmdLong(booking.start)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#9CA3AF]">Return</span>
            <span className="text-white">{formatYmdLong(booking.end)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#9CA3AF]">Booking</span>
            <span className="text-white">{booking.rentalNo}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onViewFull}
          className="w-full py-3 rounded-xl bg-[#8B5CF6] text-white font-medium text-sm hover:bg-[#7C3AED] min-h-[44px]"
        >
          View full order
        </button>
      </div>
    </div>
  );
}

function StatusLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-[10px] font-medium text-[#9CA3AF]">
      <span className="flex items-center gap-1">
        <span className="w-2.5 h-2.5 rounded bg-pink-500" /> Booked
      </span>
      <span className="flex items-center gap-1">
        <span className="w-2.5 h-2.5 rounded bg-blue-600" /> Rented
      </span>
      <span className="flex items-center gap-1">
        <span className="w-2.5 h-2.5 rounded bg-red-600" /> Overdue
      </span>
      <span className="flex items-center gap-1">
        <span className="w-2.5 h-2.5 rounded bg-green-600" /> Returned
      </span>
    </div>
  );
}

export function RentalCalendarTab({
  companyId,
  apiBranchId,
  fetchOpts,
  listBranchScope,
  scopeRentalsToOwn,
  isolateWorkerData,
  effectiveUserId,
  effectiveProfileId,
  onSelectRentalId,
}: RentalCalendarTabProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('agenda');
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [selectedProductId, setSelectedProductId] = useState<string | 'all'>('all');
  const [rentals, setRentals] = useState<RentalCalendarRental[]>([]);
  const [products, setProducts] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(!!companyId);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sheetBooking, setSheetBooking] = useState<CalendarBooking | null>(null);

  const loadData = useCallback(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    Promise.all([
      rentalsApi.getRentalsForCalendar(companyId, apiBranchId ?? null, fetchOpts),
      getRentalProducts(companyId),
    ]).then(([rentalRes, productRes]) => {
      setLoading(false);
      if (rentalRes.error) {
        setLoadError(rentalRes.error);
        setRentals([]);
      } else {
        let rows = rentalRes.data ?? [];
        rows = rows.filter((r) =>
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
        setRentals(rows);
      }
      const rentable = (productRes.data ?? []).filter((p) => p.isRentable !== false);
      setProducts(rentable.map((p) => ({ id: p.id, name: p.name || '' })));
    });
  }, [
    companyId,
    apiBranchId,
    fetchOpts,
    listBranchScope,
    scopeRentalsToOwn,
    isolateWorkerData,
    effectiveUserId,
    effectiveProfileId,
  ]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const bookings = useMemo(() => buildCalendarBookings(rentals), [rentals]);
  const productsForRows = useMemo(
    () => buildProductsForRows(products, bookings),
    [products, bookings],
  );

  const stripDays = useMemo(() => {
    const anchor = viewMode === 'weekly' ? currentDate : selectedDay;
    const start = startOfWeek(anchor);
    return eachDayOfInterval(start, addDays(start, 6));
  }, [viewMode, currentDate, selectedDay]);

  const boardDays = useMemo(() => {
    if (viewMode === 'weekly') {
      const start = startOfWeek(currentDate);
      return eachDayOfInterval(start, addDays(start, 6));
    }
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval(start, end);
  }, [viewMode, currentDate]);

  const bookingCountByDay = useMemo(() => {
    const counts = new Map<number, number>();
    for (const day of stripDays) {
      const n = bookings.filter((b) => bookingOverlapsDay(b.start, b.end, day)).length;
      counts.set(day.getTime(), n);
    }
    return counts;
  }, [bookings, stripDays]);

  const filterProducts = useMemo(() => {
    const ids = new Set<string>();
    for (const day of stripDays) {
      for (const b of bookings) {
        if (bookingOverlapsDay(b.start, b.end, day)) ids.add(b.productId);
      }
    }
    return productsForRows.filter((p) => ids.has(p.id));
  }, [bookings, stripDays, productsForRows]);

  const dayBookings = useMemo(() => {
    return bookings
      .filter(
        (b) =>
          bookingOverlapsDay(b.start, b.end, selectedDay) &&
          (selectedProductId === 'all' || b.productId === selectedProductId),
      )
      .sort((a, b) => a.customer.localeCompare(b.customer));
  }, [bookings, selectedDay, selectedProductId]);

  const colWidth = viewMode === 'weekly' ? 100 : 48;
  const gridMinWidth = boardDays.length * colWidth;
  const today = new Date();

  const handlePrev = () => {
    if (viewMode === 'weekly') {
      setCurrentDate((prev) => addDays(prev, -7));
      setSelectedDay((prev) => addDays(prev, -7));
    } else {
      setCurrentDate((prev) => addDays(prev, -30));
    }
  };

  const handleNext = () => {
    if (viewMode === 'weekly') {
      setCurrentDate((prev) => addDays(prev, 7));
      setSelectedDay((prev) => addDays(prev, 7));
    } else {
      setCurrentDate((prev) => addDays(prev, 30));
    }
  };

  const handleStripPrev = () => {
    const start = addDays(stripDays[0] ?? selectedDay, -7);
    const end = addDays(start, 6);
    if (viewMode === 'weekly') {
      setCurrentDate(start);
      if (!stripDays.some((d) => isSameDay(d, selectedDay))) setSelectedDay(start);
    } else {
      setSelectedDay((prev) => {
        if (prev >= start && prev <= end) return prev;
        return start;
      });
    }
  };

  const handleStripNext = () => {
    const start = addDays(stripDays[0] ?? selectedDay, 7);
    const end = addDays(start, 6);
    if (viewMode === 'weekly') {
      setCurrentDate(start);
      if (!stripDays.some((d) => isSameDay(d, selectedDay))) setSelectedDay(start);
    } else {
      setSelectedDay((prev) => {
        if (prev >= start && prev <= end) return prev;
        return start;
      });
    }
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDay(now);
  };

  const getEventStyle = (booking: CalendarBooking) => {
    const startDate = parseYmd(booking.start);
    const endDate = parseYmd(booking.end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
    const viewStart = boardDays[0];
    const viewEnd = boardDays[boardDays.length - 1];
    if (!viewStart || !viewEnd) return null;
    if (endDate < viewStart || startDate > viewEnd) return null;
    const visibleStart = startDate < viewStart ? viewStart : startDate;
    const visibleEnd = endDate > viewEnd ? viewEnd : endDate;
    const offsetDays = differenceInDays(visibleStart, viewStart);
    const durationDays = differenceInDays(visibleEnd, visibleStart) + 1;
    return {
      left: `${offsetDays * colWidth}px`,
      width: `${durationDays * colWidth}px`,
    };
  };

  const toolbar = (
    <div className="p-3 border-b border-[#374151] bg-[#1F2937]/80 shrink-0 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-0.5 bg-[#111827] border border-[#374151] rounded-lg p-0.5">
          <button
            type="button"
            onClick={handlePrev}
            className="h-9 w-9 flex items-center justify-center text-[#9CA3AF] hover:text-white rounded min-h-[44px] min-w-[44px]"
            aria-label="Previous period"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-white px-2 min-w-[110px] text-center">
            {formatMonthYear(currentDate)}
          </span>
          <button
            type="button"
            onClick={handleNext}
            className="h-9 w-9 flex items-center justify-center text-[#9CA3AF] hover:text-white rounded min-h-[44px] min-w-[44px]"
            aria-label="Next period"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={handleToday}
          className="px-3 py-2 text-xs font-medium border border-[#374151] rounded-lg text-white hover:bg-[#374151] min-h-[44px]"
        >
          Today
        </button>
        <div className="flex bg-[#111827] p-0.5 rounded-lg border border-[#374151]">
          <button
            type="button"
            onClick={() => setViewMode('monthly')}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-md min-h-[36px] ${
              viewMode === 'monthly' ? 'bg-[#374151] text-white' : 'text-[#9CA3AF]'
            }`}
          >
            Month
          </button>
          <button
            type="button"
            onClick={() => setViewMode('weekly')}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-md min-h-[36px] ${
              viewMode === 'weekly' ? 'bg-[#374151] text-white' : 'text-[#9CA3AF]'
            }`}
          >
            Week
          </button>
        </div>
        <div className="hidden md:flex bg-[#111827] p-0.5 rounded-lg border border-[#374151] ml-auto">
          <button
            type="button"
            onClick={() => setDisplayMode('agenda')}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-md ${
              displayMode === 'agenda' ? 'bg-[#8B5CF6] text-white' : 'text-[#9CA3AF]'
            }`}
          >
            Agenda
          </button>
          <button
            type="button"
            onClick={() => setDisplayMode('board')}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-md ${
              displayMode === 'board' ? 'bg-[#8B5CF6] text-white' : 'text-[#9CA3AF]'
            }`}
          >
            Board
          </button>
        </div>
      </div>
      <StatusLegend />
    </div>
  );

  const dayStrip = (
    <div className="border-b border-[#374151] bg-[#111827]/60 shrink-0">
      <div className="flex items-center px-1 py-2 gap-0.5">
        <button
          type="button"
          onClick={handleStripPrev}
          className="shrink-0 h-10 w-8 flex items-center justify-center text-[#9CA3AF] hover:text-white"
          aria-label="Previous week"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 overflow-x-auto flex gap-1.5 pb-1 scrollbar-thin">
          {stripDays.map((day) => {
            const isToday = isSameDay(day, today);
            const selected = isSameDay(day, selectedDay);
            const hdr = formatDayHeader(day);
            const count = bookingCountByDay.get(day.getTime()) ?? 0;
            return (
              <button
                key={day.getTime()}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={`flex-shrink-0 flex flex-col items-center justify-center min-w-[52px] min-h-[56px] rounded-xl border px-2 py-1.5 transition-colors ${
                  selected
                    ? 'bg-[#8B5CF6] border-[#8B5CF6] text-white'
                    : isToday
                      ? 'bg-blue-900/30 border-blue-600/50 text-blue-200'
                      : 'bg-[#1F2937] border-[#374151] text-[#9CA3AF] hover:border-[#6B7280]'
                }`}
              >
                <span className="text-[10px] font-medium">{hdr.weekday}</span>
                <span className={`text-sm font-bold ${selected ? 'text-white' : ''}`}>{hdr.day}</span>
                {count > 0 && (
                  <span
                    className={`mt-0.5 text-[9px] font-bold px-1.5 rounded-full ${
                      selected ? 'bg-white/20 text-white' : 'bg-[#374151] text-[#D1D5DB]'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={handleStripNext}
          className="shrink-0 h-10 w-8 flex items-center justify-center text-[#9CA3AF] hover:text-white"
          aria-label="Next week"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  const productChips = (
    <div className="flex gap-2 overflow-x-auto px-3 py-2 border-b border-[#374151]/80 shrink-0 scrollbar-thin">
      <button
        type="button"
        onClick={() => setSelectedProductId('all')}
        className={`shrink-0 px-3 py-2 rounded-full text-xs font-medium min-h-[36px] border ${
          selectedProductId === 'all'
            ? 'bg-[#8B5CF6] border-[#8B5CF6] text-white'
            : 'bg-[#1F2937] border-[#374151] text-[#9CA3AF]'
        }`}
      >
        All
      </button>
      {filterProducts.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => setSelectedProductId(p.id)}
          title={p.name}
          className={`shrink-0 max-w-[140px] px-3 py-2 rounded-full text-xs font-medium min-h-[36px] border truncate ${
            selectedProductId === p.id
              ? 'bg-[#8B5CF6] border-[#8B5CF6] text-white'
              : 'bg-[#1F2937] border-[#374151] text-[#9CA3AF]'
          }`}
        >
          {p.name}
        </button>
      ))}
    </div>
  );

  const agendaBody = (
    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0">
      {dayBookings.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-[#9CA3AF] text-sm">No bookings on this day</p>
          <div className="mt-6 flex justify-center">
            <StatusLegend />
          </div>
        </div>
      ) : (
        dayBookings.map((booking) => {
          const pill = CALENDAR_STATUS_PILL[booking.status] || CALENDAR_STATUS_PILL.draft;
          return (
            <button
              key={booking.id}
              type="button"
              onClick={() => setSheetBooking(booking)}
              className={`w-full text-left rounded-xl border border-[#374151] bg-[#1F2937] p-3 min-h-[72px] hover:border-[#8B5CF6]/50 active:bg-[#374151]/50 ${
                booking.isTodayReturn ? 'ring-1 ring-amber-400/60' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${pill}`}>
                  {statusLabel(booking.status)}
                </span>
                {booking.isTodayReturn && (
                  <span className="text-[10px] text-amber-300 shrink-0">Returns today</span>
                )}
              </div>
              <p className="font-semibold text-white truncate">{booking.customer || '—'}</p>
              <p className="text-xs text-[#8B5CF6] font-medium mt-0.5">{booking.rentalNo}</p>
              <p className="text-xs text-[#9CA3AF] truncate mt-1">{booking.productName}</p>
              <p className="text-[11px] text-[#6B7280] mt-1">
                {formatYmdLong(booking.start)} → {formatYmdLong(booking.end)}
              </p>
            </button>
          );
        })
      )}
    </div>
  );

  const boardBody = (
    <div className="hidden md:flex flex-1 min-h-0 overflow-hidden max-h-[calc(100vh-320px)]">
      <div className="w-36 lg:w-44 flex-shrink-0 border-r border-[#374151] bg-[#111827]/50 flex flex-col z-20">
        <div className="h-11 border-b border-[#374151] flex items-center px-3 text-xs font-medium text-[#9CA3AF] sticky top-0 bg-[#1F2937] shrink-0">
          Product
        </div>
        <div className="flex-1 overflow-y-auto">
          {productsForRows.length === 0 ? (
            <div className="p-3 text-[#6B7280] text-xs">No rentable products</div>
          ) : (
            productsForRows.map((product) => (
              <div
                key={product.id}
                className="h-14 border-b border-[#374151]/50 flex items-center px-3 text-xs font-medium text-[#D1D5DB] truncate"
                title={product.name}
              >
                {product.name}
              </div>
            ))
          )}
        </div>
      </div>
      <div className="flex-1 overflow-auto min-w-0">
        <div style={{ minWidth: gridMinWidth }}>
          <div className="flex h-11 border-b border-[#374151] bg-[#1F2937] sticky top-0 z-10 shrink-0">
            {boardDays.map((day) => {
              const isToday = isSameDay(day, today);
              const hdr = formatDayHeader(day);
              return (
                <div
                  key={day.getTime()}
                  style={{ width: colWidth }}
                  className={`flex-shrink-0 border-r border-[#374151] flex flex-col items-center justify-center text-[10px] font-medium ${
                    isToday ? 'bg-blue-900/30 text-blue-300' : 'text-[#9CA3AF]'
                  }`}
                >
                  <span>{hdr.weekday}</span>
                  <span className={isToday ? 'text-base font-bold' : 'text-sm'}>{hdr.day}</span>
                </div>
              );
            })}
          </div>
          <div className="relative">
            <div className="absolute inset-0 flex pointer-events-none">
              {boardDays.map((day) => (
                <div
                  key={`bg-${day.getTime()}`}
                  style={{ width: colWidth }}
                  className={`flex-shrink-0 border-r border-[#374151]/30 h-full ${
                    [0, 6].includes(day.getDay()) ? 'bg-[#111827]/40' : ''
                  }`}
                />
              ))}
            </div>
            <div className="relative z-10">
              {productsForRows.map((product) => (
                <div
                  key={product.id}
                  className="h-14 border-b border-[#374151]/50 relative"
                  style={{ minWidth: gridMinWidth }}
                >
                  {bookings
                    .filter((b) => b.productId === product.id)
                    .map((booking) => {
                      const style = getEventStyle(booking);
                      if (!style) return null;
                      const color = CALENDAR_STATUS_COLORS[booking.status] || 'bg-gray-600';
                      return (
                        <button
                          key={booking.id}
                          type="button"
                          style={{ ...style, top: '10px', height: '34px' }}
                          className={`absolute rounded-md shadow-sm border border-white/10 cursor-pointer hover:brightness-110 flex items-center px-2 overflow-hidden text-left ${color} ${
                            booking.isTodayReturn ? 'ring-2 ring-amber-400' : ''
                          }`}
                          onClick={() => setSheetBooking(booking)}
                        >
                          <div className="flex flex-col leading-tight min-w-0">
                            <span className="text-white text-[10px] font-bold truncate">
                              {booking.customer}
                            </span>
                            <span className="text-white/70 text-[9px] truncate">{booking.rentalNo}</span>
                          </div>
                        </button>
                      );
                    })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const showBoard = displayMode === 'board';

  return (
    <div className="flex flex-col min-h-[420px] bg-[#0B0F19] border border-[#374151] rounded-xl overflow-hidden md:min-h-[480px]">
      {toolbar}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-[#8B5CF6] animate-spin" />
        </div>
      ) : loadError ? (
        <div className="px-4 py-8 text-center">
          <p className="text-red-400 text-sm">Could not load calendar: {loadError}</p>
          <button
            type="button"
            onClick={loadData}
            className="mt-3 px-4 py-2 text-xs font-medium rounded-lg border border-[#374151] text-white hover:bg-[#374151]"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className={`flex flex-col flex-1 min-h-0 ${showBoard ? 'md:hidden' : ''}`}>
            {dayStrip}
            {productChips}
            {agendaBody}
          </div>
          {showBoard && boardBody}
        </>
      )}

      {sheetBooking && (
        <BookingSheet
          booking={sheetBooking}
          onClose={() => setSheetBooking(null)}
          onViewFull={() => {
            setSheetBooking(null);
            onSelectRentalId(sheetBooking.rentalId);
          }}
        />
      )}
    </div>
  );
}
