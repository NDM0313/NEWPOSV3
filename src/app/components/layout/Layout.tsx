import React from 'react';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { TopHeader } from './TopHeader';
import { MobileNavDrawer } from './MobileNavDrawer';
import { useSupabase } from '@/app/context/SupabaseContext';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const { connectionError, retryConnection } = useSupabase();

  return (
    <div className="flex min-h-screen bg-[#111827] text-[#F9FAFB] font-sans selection:bg-[#3B82F6]/30 transition-colors overflow-x-hidden">
      <Sidebar />
      
      <div className="flex-1 flex flex-col min-w-0 max-w-full overflow-x-hidden">
        <TopHeader />
        {connectionError && (
          <div className="sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-2 bg-amber-500/20 border-b border-amber-500/50 text-amber-200">
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              Service temporarily unavailable. Please try again.
            </span>
            <button
              type="button"
              onClick={retryConnection}
              className="flex items-center gap-1.5 rounded-md bg-amber-500/30 px-3 py-1.5 text-sm font-medium hover:bg-amber-500/50"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        )}
        <main className="flex-1 overflow-y-auto overflow-x-auto p-4 md:p-6 pb-24 md:pb-6 max-w-full">
          {children}
        </main>
      </div>

      <BottomNav />
      <MobileNavDrawer />
    </div>
  );
};
