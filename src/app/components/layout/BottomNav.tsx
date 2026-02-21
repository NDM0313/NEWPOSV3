import React from 'react';
import { 
  LayoutDashboard, 
  Store, 
  ScanLine, 
  Menu,
  Package
} from 'lucide-react';
import { useNavigation } from '../../context/NavigationContext';
import { clsx } from 'clsx';

export const BottomNav = () => {
  const { currentView, setCurrentView, setMobileNavOpen } = useNavigation();

  return (
    <div 
      className="md:hidden fixed bottom-0 left-0 right-0 bg-[#1F2937] border-t border-[#374151] z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex justify-around items-center h-16 px-2">
        <NavButton 
          active={currentView === 'dashboard'} 
          onClick={() => setCurrentView('dashboard')}
          icon={LayoutDashboard}
          label="Home"
        />
        <NavButton 
          active={currentView === 'pos'} 
          onClick={() => setCurrentView('pos')}
          icon={Store}
          label="POS"
        />
        {/* Center FAB - Mobile-style scan action */}
        <div className="relative -top-6 flex justify-center">
          <button 
            onClick={() => setCurrentView('pos')}
            className="w-14 h-14 bg-[#3B82F6] hover:bg-[#2563EB] rounded-2xl flex items-center justify-center shadow-lg text-white active:scale-95 transition-transform touch-manipulation border-2 border-[#374151]"
          >
            <ScanLine size={24} strokeWidth={2.5} />
          </button>
        </div>
        <NavButton 
          active={currentView === 'products'} 
          onClick={() => setCurrentView('products')}
          icon={Package}
          label="Products"
        />
        <NavButton 
          active={false} 
          onClick={() => setMobileNavOpen?.(true)}
          icon={Menu}
          label="Menu"
        />
      </div>
    </div>
  );
};

const NavButton = ({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) => (
  <button 
    onClick={onClick}
    className={clsx(
      "flex flex-col items-center justify-center min-w-[56px] py-2 gap-1 transition-all touch-manipulation rounded-xl active:scale-95",
      active ? "text-[#3B82F6]" : "text-[#9CA3AF] hover:text-white"
    )}
  >
    <Icon size={24} strokeWidth={active ? 2.5 : 2} />
    <span className="text-[11px] font-medium">{label}</span>
  </button>
);
