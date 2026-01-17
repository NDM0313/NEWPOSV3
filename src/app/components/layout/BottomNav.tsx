import React from 'react';
import { 
  LayoutDashboard, 
  Store, 
  ScanLine, 
  Menu
} from 'lucide-react';
import { useNavigation } from '../../context/NavigationContext';
import { clsx } from 'clsx';
import { Drawer } from 'vaul';

export const BottomNav = () => {
  const { currentView, setCurrentView } = useNavigation();

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 pb-safe z-50">
      <div className="flex justify-around items-center h-16">
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
        <div className="relative -top-5">
          <button className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-900/40 text-white active:scale-95 transition-transform">
            <ScanLine size={24} />
          </button>
        </div>
        <NavButton 
          active={currentView === 'products'} 
          onClick={() => setCurrentView('products')}
          icon={Menu} // This could trigger a "More" menu in a real app, mapping to products for now
          label="Menu"
        />
      </div>
    </div>
  );
};

const NavButton = ({ active, onClick, icon: Icon, label }: any) => (
  <button 
    onClick={onClick}
    className={clsx(
      "flex flex-col items-center justify-center w-16 gap-1 transition-colors",
      active ? "text-blue-500" : "text-gray-400 hover:text-gray-300"
    )}
  >
    <Icon size={22} strokeWidth={active ? 2.5 : 2} />
    <span className="text-[10px] font-medium">{label}</span>
  </button>
);
