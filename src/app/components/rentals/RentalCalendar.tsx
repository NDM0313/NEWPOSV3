import React, { useState } from 'react';
import { 
  addDays, 
  startOfWeek, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  isWithinInterval,
  parseISO,
  differenceInDays
} from 'date-fns';
import { formatDate } from '../../../utils/dateFormat';
import { ChevronLeft, ChevronRight, User, Info } from 'lucide-react';
import { Button } from "../ui/button";
import { ScrollArea, ScrollBar } from "../ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { cn } from "../ui/utils";

// Mock Data for Calendar
const products = [
  { id: 1, name: "Royal Red Bridal Lehenga" },
  { id: 2, name: "Emerald Green Sharara" },
  { id: 3, name: "Ivory Gold Gown" },
  { id: 4, name: "Peach Walima Dress" },
  { id: 5, name: "Luxury Silk Saree (Retail)" },
];

const bookings = [
  { 
    id: "B-101", 
    productId: 1, 
    customer: "Sarah Khan", 
    start: "2024-01-28", 
    end: "2024-02-02", 
    status: "active", // Orange
    color: "bg-orange-500"
  },
  { 
    id: "B-102", 
    productId: 1, 
    customer: "Next Client", 
    start: "2024-02-05", 
    end: "2024-02-08", 
    status: "future", // Blue
    color: "bg-blue-600"
  },
  { 
    id: "B-103", 
    productId: 2, 
    customer: "Fatima Ali", 
    start: "2024-01-30", 
    end: "2024-02-04", 
    status: "future", 
    color: "bg-blue-600"
  },
  { 
    id: "B-104", 
    productId: 4, 
    customer: "Ayesha M.", 
    start: "2024-01-25", 
    end: "2024-01-29", 
    status: "active", 
    color: "bg-orange-500"
  },
];

type ViewMode = 'weekly' | 'monthly';

export const RentalCalendar = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [currentDate, setCurrentDate] = useState(new Date());

  // Date Calculations
  const getDays = () => {
    if (viewMode === 'weekly') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      return eachDayOfInterval({ start, end: addDays(start, 6) });
    } else {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      return eachDayOfInterval({ start, end });
    }
  };

  const days = getDays();
  const colWidth = viewMode === 'weekly' ? 150 : 60; // Wider cols for weekly view

  const handlePrev = () => {
    setCurrentDate(prev => viewMode === 'weekly' ? addDays(prev, -7) : addDays(prev, -30));
  };

  const handleNext = () => {
    setCurrentDate(prev => viewMode === 'weekly' ? addDays(prev, 7) : addDays(prev, 30));
  };

  // Helper to position bars
  const getEventStyle = (booking: typeof bookings[0]) => {
    const startDate = parseISO(booking.start);
    const endDate = parseISO(booking.end);
    
    // Find intersection with current view
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

  return (
    <div 
      className="flex flex-col h-[600px] border rounded-xl overflow-hidden"
      style={{
        backgroundColor: 'var(--color-bg-tertiary)',
        borderColor: 'var(--color-border-primary)',
        borderRadius: 'var(--radius-xl)'
      }}
    >
      {/* Calendar Toolbar */}
      <div 
        className="p-4 border-b flex justify-between items-center"
        style={{
          borderBottomColor: 'var(--color-border-primary)',
          backgroundColor: 'rgba(17, 24, 39, 0.5)'
        }}
      >
        <div className="flex items-center gap-4">
          <div 
            className="flex items-center gap-1 border rounded-lg p-1"
            style={{
              backgroundColor: 'var(--color-bg-card)',
              borderColor: 'var(--color-border-primary)',
              borderRadius: 'var(--radius-lg)'
            }}
          >
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handlePrev}
              className="h-7 w-7 p-0"
              style={{ color: 'var(--color-text-secondary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--color-text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--color-text-secondary)';
              }}
            >
              <ChevronLeft size={16} />
            </Button>
            <span 
              className="text-sm font-medium px-2 min-w-[120px] text-center"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {format(currentDate, viewMode === 'weekly' ? 'MMMM yyyy' : 'MMMM yyyy')}
            </span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleNext}
              className="h-7 w-7 p-0"
              style={{ color: 'var(--color-text-secondary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--color-text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--color-text-secondary)';
              }}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setCurrentDate(new Date())} 
            className="text-xs h-8"
            style={{
              borderColor: 'var(--color-border-secondary)',
              color: 'var(--color-text-secondary)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--color-text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--color-text-secondary)';
            }}
          >
            Today
          </Button>
        </div>

        <div 
          className="flex p-1 rounded-lg border"
          style={{
            backgroundColor: 'var(--color-bg-card)',
            borderColor: 'var(--color-border-primary)',
            borderRadius: 'var(--radius-lg)'
          }}
        >
          <button
            onClick={() => setViewMode('monthly')}
            className="px-3 py-1 text-xs font-medium rounded-md transition-all"
            style={{
              backgroundColor: viewMode === 'monthly' 
                ? 'var(--color-bg-card)' 
                : 'transparent',
              color: viewMode === 'monthly' 
                ? 'var(--color-text-primary)' 
                : 'var(--color-text-secondary)',
              borderRadius: 'var(--radius-md)',
              boxShadow: viewMode === 'monthly' ? '0 1px 2px rgba(0, 0, 0, 0.1)' : 'none'
            }}
            onMouseEnter={(e) => {
              if (viewMode !== 'monthly') {
                e.currentTarget.style.color = 'var(--color-text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              if (viewMode !== 'monthly') {
                e.currentTarget.style.color = 'var(--color-text-secondary)';
              }
            }}
          >
            Monthly
          </button>
          <button
            onClick={() => setViewMode('weekly')}
            className="px-3 py-1 text-xs font-medium rounded-md transition-all"
            style={{
              backgroundColor: viewMode === 'weekly' 
                ? 'var(--color-bg-card)' 
                : 'transparent',
              color: viewMode === 'weekly' 
                ? 'var(--color-text-primary)' 
                : 'var(--color-text-secondary)',
              borderRadius: 'var(--radius-md)',
              boxShadow: viewMode === 'weekly' ? '0 1px 2px rgba(0, 0, 0, 0.1)' : 'none'
            }}
            onMouseEnter={(e) => {
              if (viewMode !== 'weekly') {
                e.currentTarget.style.color = 'var(--color-text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              if (viewMode !== 'weekly') {
                e.currentTarget.style.color = 'var(--color-text-secondary)';
              }
            }}
          >
            Weekly
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar (Rows Header) */}
        <div 
          className="w-64 flex-shrink-0 border-r z-20 flex flex-col"
          style={{
            borderRightColor: 'var(--color-border-primary)',
            backgroundColor: 'rgba(17, 24, 39, 0.3)'
          }}
        >
          <div 
            className="h-12 border-b flex items-center px-4 font-medium text-sm"
            style={{
              borderBottomColor: 'var(--color-border-primary)',
              backgroundColor: 'var(--color-bg-card)',
              color: 'var(--color-text-secondary)'
            }}
          >
            Product Name
          </div>
          <ScrollArea className="flex-1">
            <div className="flex flex-col">
              {products.map((product) => (
                <div 
                  key={product.id} 
                  className="h-16 border-b flex items-center px-4 text-sm font-medium transition-colors truncate"
                  style={{
                    borderBottomColor: 'rgba(31, 41, 55, 0.5)',
                    color: 'var(--color-text-primary)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {product.name}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Main Timeline Area */}
        <ScrollArea 
          className="flex-1"
          style={{ backgroundColor: 'rgba(17, 24, 39, 0.5)' }}
        >
          <div className="min-w-max">
            {/* Header Row (Days) */}
            <div 
              className="flex h-12 border-b sticky top-0 z-10"
              style={{
                borderBottomColor: 'var(--color-border-primary)',
                backgroundColor: 'var(--color-bg-card)'
              }}
            >
              {days.map((day) => {
                const isToday = isSameDay(day, new Date());
                return (
                  <div 
                    key={day.toISOString()} 
                    style={{ 
                      width: colWidth,
                      borderRightColor: 'var(--color-border-primary)',
                      backgroundColor: isToday 
                        ? 'rgba(59, 130, 246, 0.2)' 
                        : 'transparent',
                      color: isToday 
                        ? 'var(--color-primary)' 
                        : 'var(--color-text-secondary)'
                    }}
                    className="flex-shrink-0 border-r flex flex-col items-center justify-center text-xs font-medium"
                  >
                    <span>{format(day, 'EEE')}</span>
                    <span 
                      className={cn("text-lg", isToday && "font-bold")}
                    >
                      {format(day, 'd')}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Rows & Events */}
            <div className="relative">
               {/* Background Grid */}
               <div className="absolute inset-0 flex pointer-events-none">
                  {days.map((day) => (
                    <div 
                      key={day.toISOString()} 
                      style={{ 
                        width: colWidth,
                        borderRightColor: 'rgba(31, 41, 55, 0.3)',
                        backgroundColor: [0, 6].includes(day.getDay()) 
                          ? 'rgba(17, 24, 39, 0.2)' 
                          : 'transparent'
                      }}
                      className="flex-shrink-0 border-r h-full"
                    />
                  ))}
               </div>

               {/* Product Rows Layer */}
               <div className="relative z-10">
                 {products.map((product) => (
                   <div 
                     key={product.id} 
                     className="h-16 border-b relative"
                     style={{
                       borderBottomColor: 'rgba(31, 41, 55, 0.5)'
                     }}
                   >
                      {/* Events for this product */}
                      {bookings
                        .filter(b => b.productId === product.id)
                        .map(booking => {
                          const style = getEventStyle(booking);
                          if (!style) return null;

                          return (
                            <Popover key={booking.id}>
                              <PopoverTrigger asChild>
                                <div
                                  style={{ 
                                    ...style, 
                                    top: '12px', 
                                    height: '40px',
                                    backgroundColor: booking.status === 'active' 
                                      ? 'var(--color-warning)' 
                                      : 'var(--color-primary)',
                                    borderColor: 'rgba(255, 255, 255, 0.1)',
                                    borderRadius: 'var(--radius-md)',
                                    color: 'var(--color-text-primary)'
                                  }}
                                  className="absolute shadow-sm cursor-pointer hover:brightness-110 transition-all flex items-center px-3 overflow-hidden"
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.opacity = '0.9';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.opacity = '1';
                                  }}
                                >
                                  <div className="flex flex-col leading-none">
                                    <span 
                                      className="text-xs font-bold truncate"
                                      style={{ color: 'var(--color-text-primary)' }}
                                    >
                                      {booking.customer}
                                    </span>
                                    <span 
                                      className="text-[10px] truncate"
                                      style={{ color: 'rgba(255, 255, 255, 0.7)' }}
                                    >
                                      {booking.id}
                                    </span>
                                  </div>
                                </div>
                              </PopoverTrigger>
                              <PopoverContent 
                                className="w-80 p-0 shadow-xl"
                                style={{
                                  backgroundColor: 'var(--color-bg-card)',
                                  borderColor: 'var(--color-border-primary)',
                                  color: 'var(--color-text-primary)'
                                }}
                              >
                                <div 
                                  className="p-4 border-b flex items-center gap-3"
                                  style={{
                                    borderBottomColor: 'var(--color-border-primary)'
                                  }}
                                >
                                  <div 
                                    className="h-10 w-10 rounded-full flex items-center justify-center font-bold text-lg"
                                    style={{
                                      background: 'linear-gradient(to top right, var(--color-wholesale), var(--color-primary))',
                                      color: 'var(--color-text-primary)',
                                      borderRadius: 'var(--radius-full)'
                                    }}
                                  >
                                    {booking.customer.charAt(0)}
                                  </div>
                                  <div>
                                    <h4 
                                      className="font-bold"
                                      style={{ color: 'var(--color-text-primary)' }}
                                    >
                                      {booking.customer}
                                    </h4>
                                    <Badge 
                                      variant="secondary" 
                                      className="mt-1 text-xs"
                                      style={{
                                        backgroundColor: 'var(--color-bg-card)',
                                        color: 'var(--color-text-secondary)'
                                      }}
                                    >
                                      {booking.status === 'active' ? 'Currently Rented' : 'Future Booking'}
                                    </Badge>
                                  </div>
                                </div>
                                <div className="p-4 space-y-3">
                                  <div className="flex justify-between text-sm">
                                    <span style={{ color: 'var(--color-text-tertiary)' }}>Pickup</span>
                                    <span style={{ color: 'var(--color-text-primary)' }}>
                                      {formatDate(parseISO(booking.start))}
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span style={{ color: 'var(--color-text-tertiary)' }}>Return</span>
                                    <span style={{ color: 'var(--color-text-primary)' }}>
                                      {formatDate(parseISO(booking.end))}
                                    </span>
                                  </div>
                                  <div 
                                    className="mt-4 pt-4 border-t flex justify-end"
                                    style={{
                                      borderTopColor: 'var(--color-border-primary)'
                                    }}
                                  >
                                    <Button 
                                      size="sm" 
                                      variant="ghost"
                                      style={{ color: 'var(--color-primary)' }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.color = 'var(--color-text-primary)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.color = 'var(--color-primary)';
                                      }}
                                    >
                                      View Full Order
                                    </Button>
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
