import React, { useState } from 'react';
import { 
  format, 
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
    <div className="flex flex-col h-[600px] bg-gray-950 border border-gray-800 rounded-xl overflow-hidden">
      {/* Calendar Toolbar */}
      <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handlePrev}
              className="h-7 w-7 p-0 text-gray-400 hover:text-white"
            >
              <ChevronLeft size={16} />
            </Button>
            <span className="text-sm font-medium text-white px-2 min-w-[120px] text-center">
              {format(currentDate, viewMode === 'weekly' ? 'MMMM yyyy' : 'MMMM yyyy')}
            </span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleNext}
              className="h-7 w-7 p-0 text-gray-400 hover:text-white"
            >
              <ChevronRight size={16} />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())} className="text-xs h-8">
            Today
          </Button>
        </div>

        <div className="flex bg-gray-900 p-1 rounded-lg border border-gray-800">
          <button
            onClick={() => setViewMode('monthly')}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-md transition-all",
              viewMode === 'monthly' ? "bg-gray-800 text-white shadow-sm" : "text-gray-400 hover:text-white"
            )}
          >
            Monthly
          </button>
          <button
            onClick={() => setViewMode('weekly')}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-md transition-all",
              viewMode === 'weekly' ? "bg-gray-800 text-white shadow-sm" : "text-gray-400 hover:text-white"
            )}
          >
            Weekly
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar (Rows Header) */}
        <div className="w-64 flex-shrink-0 border-r border-gray-800 bg-gray-900/30 z-20 flex flex-col">
          <div className="h-12 border-b border-gray-800 flex items-center px-4 bg-gray-900 font-medium text-sm text-gray-400">
            Product Name
          </div>
          <ScrollArea className="flex-1">
            <div className="flex flex-col">
              {products.map((product) => (
                <div key={product.id} className="h-16 border-b border-gray-800/50 flex items-center px-4 text-sm font-medium text-gray-300 hover:bg-gray-800/30 transition-colors truncate">
                  {product.name}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Main Timeline Area */}
        <ScrollArea className="flex-1 bg-gray-950/50">
          <div className="min-w-max">
            {/* Header Row (Days) */}
            <div className="flex h-12 border-b border-gray-800 bg-gray-900 sticky top-0 z-10">
              {days.map((day) => {
                const isToday = isSameDay(day, new Date());
                return (
                  <div 
                    key={day.toISOString()} 
                    style={{ width: colWidth }} 
                    className={cn(
                      "flex-shrink-0 border-r border-gray-800 flex flex-col items-center justify-center text-xs font-medium",
                      isToday ? "bg-blue-900/20 text-blue-400" : "text-gray-400"
                    )}
                  >
                    <span>{format(day, 'EEE')}</span>
                    <span className={cn("text-lg", isToday && "font-bold")}>{format(day, 'd')}</span>
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
                      style={{ width: colWidth }} 
                      className={cn(
                        "flex-shrink-0 border-r border-gray-800/30 h-full",
                        [0, 6].includes(day.getDay()) ? "bg-gray-900/20" : "" // Highlight weekends
                      )}
                    />
                  ))}
               </div>

               {/* Product Rows Layer */}
               <div className="relative z-10">
                 {products.map((product) => (
                   <div key={product.id} className="h-16 border-b border-gray-800/50 relative">
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
                                  style={{ ...style, top: '12px', height: '40px' }}
                                  className={cn(
                                    "absolute rounded-md shadow-sm border border-white/10 cursor-pointer hover:brightness-110 transition-all flex items-center px-3 overflow-hidden",
                                    booking.color
                                  )}
                                >
                                  <div className="flex flex-col leading-none">
                                    <span className="text-white text-xs font-bold truncate">{booking.customer}</span>
                                    <span className="text-white/70 text-[10px] truncate">{booking.id}</span>
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
                                    <Badge variant="secondary" className="mt-1 text-xs bg-gray-800 text-gray-300">
                                      {booking.status === 'active' ? 'Currently Rented' : 'Future Booking'}
                                    </Badge>
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
                                    <Button size="sm" variant="ghost" className="text-blue-400 hover:text-white">
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
