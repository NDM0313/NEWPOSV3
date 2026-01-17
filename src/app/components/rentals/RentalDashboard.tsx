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
          <h2 
            className="text-2xl font-bold tracking-tight"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Rental Management
          </h2>
          <p 
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Track active bookings, returns, and inventory availability.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div 
            className="p-1 rounded-lg border flex items-center"
            style={{
              backgroundColor: 'var(--color-bg-card)',
              borderColor: 'var(--color-border-primary)',
              borderRadius: 'var(--radius-lg)'
            }}
          >
             <button 
               onClick={() => setViewMode('list')}
               className="p-2 rounded-md transition-all"
               style={{
                 backgroundColor: viewMode === 'list' ? 'var(--color-hover-bg)' : 'transparent',
                 color: viewMode === 'list' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                 boxShadow: viewMode === 'list' ? '0 1px 2px rgba(0, 0, 0, 0.1)' : 'none',
                 borderRadius: 'var(--radius-md)'
               }}
               onMouseEnter={(e) => {
                 if (viewMode !== 'list') {
                   e.currentTarget.style.color = 'var(--color-text-primary)';
                 }
               }}
               onMouseLeave={(e) => {
                 if (viewMode !== 'list') {
                   e.currentTarget.style.color = 'var(--color-text-secondary)';
                 }
               }}
               title="List View"
             >
               <LayoutList size={18} />
             </button>
             <button 
               onClick={() => setViewMode('calendar')}
               className="p-2 rounded-md transition-all"
               style={{
                 backgroundColor: viewMode === 'calendar' ? 'var(--color-hover-bg)' : 'transparent',
                 color: viewMode === 'calendar' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                 boxShadow: viewMode === 'calendar' ? '0 1px 2px rgba(0, 0, 0, 0.1)' : 'none',
                 borderRadius: 'var(--radius-md)'
               }}
               onMouseEnter={(e) => {
                 if (viewMode !== 'calendar') {
                   e.currentTarget.style.color = 'var(--color-text-primary)';
                 }
               }}
               onMouseLeave={(e) => {
                 if (viewMode !== 'calendar') {
                   e.currentTarget.style.color = 'var(--color-text-secondary)';
                 }
               }}
               title="Calendar View"
             >
               <CalendarIcon size={18} />
             </button>
          </div>

          <Button 
            onClick={() => setIsDrawerOpen(true)}
            className="font-semibold"
            style={{
              backgroundColor: 'rgba(236, 72, 153, 1)',
              color: 'var(--color-text-primary)',
              boxShadow: '0 10px 15px -3px rgba(236, 72, 153, 0.2)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(219, 39, 119, 1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(236, 72, 153, 1)';
            }}
          >
            <Plus size={18} className="mr-2" /> New Rental Booking
          </Button>
        </div>
      </div>

      {/* Stats Cards - Only visible in List View to save space in Calendar */}
      {viewMode === 'list' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
            <div 
              className="border p-4 rounded-xl"
              style={{
                backgroundColor: 'var(--color-bg-card)',
                borderColor: 'var(--color-border-primary)',
                borderRadius: 'var(--radius-xl)'
              }}
            >
                <p 
                  className="text-sm"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  Active Rentals
                </p>
                <h3 
                  className="text-2xl font-bold mt-1"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  12
                </h3>
            </div>
            <div 
              className="border p-4 rounded-xl"
              style={{
                backgroundColor: 'var(--color-bg-card)',
                borderColor: 'var(--color-border-primary)',
                borderRadius: 'var(--radius-xl)'
              }}
            >
                <p 
                  className="text-sm"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  Returns Due Today
                </p>
                <h3 
                  className="text-2xl font-bold mt-1"
                  style={{ color: 'var(--color-warning)' }}
                >
                  1
                </h3>
            </div>
            <div 
              className="border p-4 rounded-xl"
              style={{
                backgroundColor: 'var(--color-bg-card)',
                borderColor: 'var(--color-border-primary)',
                borderRadius: 'var(--radius-xl)'
              }}
            >
                <p 
                  className="text-sm"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  Overdue Items
                </p>
                <h3 
                  className="text-2xl font-bold mt-1"
                  style={{ color: 'var(--color-error)' }}
                >
                  1
                </h3>
            </div>
            <div 
              className="border p-4 rounded-xl"
              style={{
                backgroundColor: 'var(--color-bg-card)',
                borderColor: 'var(--color-border-primary)',
                borderRadius: 'var(--radius-xl)'
              }}
            >
                <p 
                  className="text-sm"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  Total Revenue (Dec)
                </p>
                <h3 
                  className="text-2xl font-bold mt-1"
                  style={{ color: 'var(--color-success)' }}
                >
                  $450k
                </h3>
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
