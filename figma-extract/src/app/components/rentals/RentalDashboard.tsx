import React, { useState } from 'react';
import { Plus, LayoutList, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from "../ui/button";
import { RentalBookingDrawer } from './RentalBookingDrawer';
import { RentalOrdersList } from './RentalOrdersList';
import { RentalCalendar } from './RentalCalendar';
import { clsx } from 'clsx';

export const RentalDashboard = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Rental Management</h2>
          <p className="text-gray-400">Track active bookings, returns, and inventory availability.</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="bg-gray-900 p-1 rounded-lg border border-gray-800 flex items-center">
             <button 
               onClick={() => setViewMode('list')}
               className={clsx(
                 "p-2 rounded-md transition-all",
                 viewMode === 'list' ? "bg-gray-800 text-white shadow-sm" : "text-gray-400 hover:text-white"
               )}
               title="List View"
             >
               <LayoutList size={18} />
             </button>
             <button 
               onClick={() => setViewMode('calendar')}
               className={clsx(
                 "p-2 rounded-md transition-all",
                 viewMode === 'calendar' ? "bg-gray-800 text-white shadow-sm" : "text-gray-400 hover:text-white"
               )}
               title="Calendar View"
             >
               <CalendarIcon size={18} />
             </button>
          </div>

          <Button 
            onClick={() => setIsDrawerOpen(true)}
            className="bg-pink-600 hover:bg-pink-500 text-white shadow-lg shadow-pink-600/20 font-semibold"
          >
            <Plus size={18} className="mr-2" /> New Rental Booking
          </Button>
        </div>
      </div>

      {/* Stats Cards - Only visible in List View to save space in Calendar */}
      {viewMode === 'list' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
            <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl">
                <p className="text-gray-500 text-sm">Active Rentals</p>
                <h3 className="text-2xl font-bold text-white mt-1">12</h3>
            </div>
            <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl">
                <p className="text-gray-500 text-sm">Returns Due Today</p>
                <h3 className="text-2xl font-bold text-orange-400 mt-1">1</h3>
            </div>
            <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl">
                <p className="text-gray-500 text-sm">Overdue Items</p>
                <h3 className="text-2xl font-bold text-red-500 mt-1">1</h3>
            </div>
            <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl">
                <p className="text-gray-500 text-sm">Total Revenue (Dec)</p>
                <h3 className="text-2xl font-bold text-green-500 mt-1">$450k</h3>
            </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-h-0">
         {viewMode === 'list' ? <RentalOrdersList /> : <RentalCalendar />}
      </div>

      <RentalBookingDrawer 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)} 
      />
    </div>
  );
};
