import React, { useState, useMemo } from 'react';
import {
  format,
  addDays,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  parseISO,
  differenceInDays,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea, ScrollBar } from '../ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import { cn } from '../ui/utils';
import { useRentals, RentalUI } from '@/app/context/RentalContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { productService } from '@/app/services/productService';

type ViewMode = 'weekly' | 'monthly';

interface CalendarBooking {
  id: string;
  rentalId: string;
  rentalNo: string;
  productId: string;
  productName: string;
  customer: string;
  start: string;
  end: string;
  status: string;
  isTodayReturn: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  booked: 'bg-pink-500',
  rented: 'bg-blue-600',
  overdue: 'bg-red-600',
  returned: 'bg-green-600',
  cancelled: 'bg-gray-600',
  picked_up: 'bg-blue-600',
  active: 'bg-blue-600',
  closed: 'bg-green-600',
};

interface RentalCalendarProps {
  onViewRental?: (rental: RentalUI) => void;
}

export const RentalCalendar = ({ onViewRental }: RentalCalendarProps) => {
  const { companyId } = useSupabase();
  const { rentals, loading } = useRentals();
  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [products, setProducts] = useState<Array<{ id: string; name: string }>>([]);

  React.useEffect(() => {
    if (!companyId) return;
    productService
      .getAllProducts(companyId)
      .then((list) => {
        const rentable = (list || []).filter((p: any) => p.is_rentable !== false);
        setProducts(rentable.map((p: any) => ({ id: p.id, name: p.name || '' })));
      })
      .catch(() => setProducts([]));
  }, [companyId]);

  const bookings = useMemo((): CalendarBooking[] => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const result: CalendarBooking[] = [];
    const activeStatuses = ['booked', 'rented', 'overdue', 'picked_up', 'active', 'returned', 'closed'];

    for (const r of rentals) {
      if (!activeStatuses.includes(r.status)) continue;
      const items = r.items ?? [];
      for (const item of items) {
        result.push({
          id: `${r.id}-${item.productId}`,
          rentalId: r.id,
          rentalNo: r.rentalNo,
          productId: item.productId,
          productName: item.productName || '',
          customer: r.customerName || '',
          start: r.startDate,
          end: r.expectedReturnDate,
          status: r.status,
          isTodayReturn: r.expectedReturnDate === today && ['booked', 'rented', 'overdue'].includes(r.status),
        });
      }
    }

    const productIdsFromBookings = new Set(result.map((b) => b.productId));
    for (const p of products) {
      if (!productIdsFromBookings.has(p.id)) {
        productIdsFromBookings.add(p.id);
      }
    }
    return result;
  }, [rentals, products]);

  const productsForRows = useMemo(() => {
    const byProduct = new Map<string, { id: string; name: string }>();
    for (const p of products) {
      byProduct.set(p.id, p);
    }
    for (const b of bookings) {
      if (!byProduct.has(b.productId)) {
        byProduct.set(b.productId, { id: b.productId, name: b.productName || 'Unknown' });
      }
    }
    return Array.from(byProduct.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [products, bookings]);

  const getDays = () => {
    if (viewMode === 'weekly') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      return eachDayOfInterval({ start, end: addDays(start, 6) });
    }
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  };

  const days = getDays();
  const colWidth = viewMode === 'weekly' ? 150 : 60;

  const handlePrev = () => {
    setCurrentDate((prev) => (viewMode === 'weekly' ? addDays(prev, -7) : addDays(prev, -30)));
  };

  const handleNext = () => {
    setCurrentDate((prev) => (viewMode === 'weekly' ? addDays(prev, 7) : addDays(prev, 30)));
  };

  const getEventStyle = (booking: CalendarBooking) => {
    const startDate = parseISO(booking.start);
    const endDate = parseISO(booking.end);
    const viewStart = days[0];
    const viewEnd = days[days.length - 1];

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

  const getRentalById = (id: string) => rentals.find((r) => r.id === id);

  return (
    <div className="flex flex-col h-full min-h-[500px] bg-gray-950 border border-gray-800 rounded-xl overflow-hidden max-h-[75vh]">
      <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1">
            <Button variant="ghost" size="sm" onClick={handlePrev} className="h-7 w-7 p-0 text-gray-400 hover:text-white">
              <ChevronLeft size={16} />
            </Button>
            <span className="text-sm font-medium text-white px-2 min-w-[120px] text-center">
              {format(currentDate, 'MMMM yyyy')}
            </span>
            <Button variant="ghost" size="sm" onClick={handleNext} className="h-7 w-7 p-0 text-gray-400 hover:text-white">
              <ChevronRight size={16} />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())} className="text-xs h-8">
            Today
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex gap-4 text-xs font-medium text-gray-300">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-pink-500" /> Booked</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-600" /> Rented</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-600" /> Overdue</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-600" /> Returned</span>
          </div>
          <div className="flex bg-gray-900 p-1 rounded-lg border border-gray-800">
            <button
              onClick={() => setViewMode('monthly')}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-md transition-all',
                viewMode === 'monthly' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:text-white'
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setViewMode('weekly')}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-md transition-all',
                viewMode === 'weekly' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:text-white'
              )}
            >
              Weekly
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-y-auto overflow-x-auto min-h-0">
        <div className="w-64 flex-shrink-0 border-r border-gray-800 bg-gray-900/30 z-20 flex flex-col">
          <div className="h-12 border-b border-gray-800 flex items-center px-4 bg-gray-900 font-medium text-sm text-gray-400 sticky top-0 z-10 shrink-0">
            Product Name
          </div>
          <ScrollArea className="flex-1">
            <div className="flex flex-col">
              {loading ? (
                <div className="p-4 text-gray-500 text-sm">Loading…</div>
              ) : productsForRows.length === 0 ? (
                <div className="p-4 text-gray-500 text-sm">No rentable products</div>
              ) : (
                productsForRows.map((product) => (
                  <div
                    key={product.id}
                    className="h-16 border-b border-gray-800/50 flex items-center px-4 text-sm font-medium text-gray-300 hover:bg-gray-800/30 transition-colors truncate"
                  >
                    {product.name}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <ScrollArea className="flex-1 bg-gray-950/50 overflow-x-auto min-w-0">
          <div className="min-w-[1200px]">
            <div className="flex h-12 border-b border-gray-800 bg-gray-900 sticky top-0 z-10 shrink-0">
              {days.map((day) => {
                const isToday = isSameDay(day, new Date());
                return (
                  <div
                    key={day.toISOString()}
                    style={{ width: colWidth }}
                    className={cn(
                      'flex-shrink-0 border-r border-gray-800 flex flex-col items-center justify-center text-xs font-medium',
                      isToday ? 'bg-blue-900/20 text-blue-400' : 'text-gray-400'
                    )}
                  >
                    <span>{format(day, 'EEE')}</span>
                    <span className={cn('text-lg', isToday && 'font-bold')}>{format(day, 'd')}</span>
                  </div>
                );
              })}
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex pointer-events-none">
                {days.map((day) => (
                  <div
                    key={day.toISOString()}
                    style={{ width: colWidth }}
                    className={cn(
                      'flex-shrink-0 border-r border-gray-800/30 h-full',
                      [0, 6].includes(day.getDay()) ? 'bg-gray-900/20' : ''
                    )}
                  />
                ))}
              </div>

              <div className="relative z-10">
                {productsForRows.map((product) => (
                  <div key={product.id} className="h-16 border-b border-gray-800/50 relative">
                    {bookings
                      .filter((b) => b.productId === product.id)
                      .map((booking) => {
                        const style = getEventStyle(booking);
                        if (!style) return null;

                        const color = STATUS_COLORS[booking.status] || 'bg-gray-600';

                        return (
                          <Popover key={booking.id}>
                            <PopoverTrigger asChild>
                              <div
                                style={{ ...style, top: '12px', height: '40px' }}
                                className={cn(
                                  'absolute rounded-md shadow-sm border cursor-pointer hover:brightness-110 transition-all flex items-center px-3 overflow-hidden',
                                  color,
                                  booking.isTodayReturn && 'ring-2 ring-amber-400 ring-offset-1 ring-offset-gray-950'
                                )}
                              >
                                <div className="flex flex-col leading-none">
                                  <span className="text-white text-xs font-bold truncate">{booking.customer}</span>
                                  <span className="text-white/70 text-[10px] truncate">{booking.rentalNo}</span>
                                </div>
                              </div>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 p-0 bg-gray-900 border-gray-800 text-white shadow-xl">
                              <div className="p-4 border-b border-gray-800 flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center font-bold text-lg">
                                  {booking.customer.charAt(0)}
                                </div>
                                <div>
                                  <h4 className="font-bold">{booking.customer}</h4>
                                  <Badge
                                    variant="secondary"
                                    className={cn(
                                      'mt-1 text-xs capitalize',
                                      booking.status === 'overdue' && 'bg-red-500/20 text-red-400 border-red-500/30',
                                      booking.status === 'booked' && 'bg-pink-500/20 text-pink-400',
                                      booking.status === 'rented' && 'bg-blue-500/20 text-blue-400',
                                      booking.status === 'returned' && 'bg-green-500/20 text-green-400'
                                    )}
                                  >
                                    {booking.status}
                                  </Badge>
                                  {booking.isTodayReturn && (
                                    <Badge className="ml-1 mt-1 bg-amber-500/20 text-amber-400 border-amber-500/30">
                                      Returns today
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="p-4 space-y-3">
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-500">Pickup</span>
                                  <span className="text-white">{format(parseISO(booking.start), 'PPP')}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-500">Return</span>
                                  <span className="text-white">{format(parseISO(booking.end), 'PPP')}</span>
                                </div>
                                <div className="mt-4 pt-4 border-t border-gray-800 flex justify-end">
                                  {onViewRental && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-blue-400 hover:text-white"
                                      onClick={() => {
                                        const rental = getRentalById(booking.rentalId);
                                        if (rental) onViewRental(rental);
                                      }}
                                    >
                                      View Full Order
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        );
                      })}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </div>
  );
};
