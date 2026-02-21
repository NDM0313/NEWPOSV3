import React from 'react';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { TopHeader } from './TopHeader';
import { MobileNavDrawer } from './MobileNavDrawer';

export const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex min-h-screen bg-[#111827] text-[#F9FAFB] font-sans selection:bg-[#3B82F6]/30 transition-colors overflow-x-hidden">
      <Sidebar />
      
      <div className="flex-1 flex flex-col min-w-0 max-w-full overflow-x-hidden">
        <TopHeader />
        
        <main className="flex-1 overflow-y-auto overflow-x-auto p-4 md:p-6 pb-24 md:pb-6 max-w-full">
          {children}
        </main>
      </div>

      <BottomNav />
      <MobileNavDrawer />
    </div>
  );
};
