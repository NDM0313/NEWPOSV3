import React, { useState } from 'react';
import { Plus, LayoutList, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '../ui/button';
import { RentalBookingDrawer } from './RentalBookingDrawer';
import { RentalsPage } from './RentalsPage';
import { RentalCalendar } from './RentalCalendar';
import { clsx } from 'clsx';

export const RentalDashboard = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  if (viewMode === 'list') {
    return (
      <>
        <RentalsPage onAddRental={() => setIsDrawerOpen(true)} />
        <RentalBookingDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
      </>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Rental Management</h2>
          <p className="text-gray-400">Track active bookings, returns, and inventory availability.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-gray-900 p-1 rounded-lg border border-gray-800 flex items-center">
            <button
              onClick={() => setViewMode('list')}
              className={clsx(
                'p-2 rounded-md transition-all',
                viewMode === 'list' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:text-white'
              )}
              title="List View"
            >
              <LayoutList size={18} />
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={clsx(
                'p-2 rounded-md transition-all',
                viewMode === 'calendar' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:text-white'
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
      <div className="flex-1 min-h-0">
        <RentalCalendar />
      </div>
      <RentalBookingDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
    </div>
  );
};
