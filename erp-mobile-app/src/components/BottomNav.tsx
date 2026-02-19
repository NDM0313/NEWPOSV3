import { Home, ShoppingCart, Store, Users, MoreHorizontal } from 'lucide-react';
import type { BottomNavTab } from '../types';

interface BottomNavProps {
  activeTab: BottomNavTab;
  onTabChange: (tab: BottomNavTab) => void;
}

const TABS: { id: BottomNavTab; icon: typeof Home; label: string; isCenter?: boolean }[] = [
  { id: 'home', icon: Home, label: 'Home' },
  { id: 'sales', icon: ShoppingCart, label: 'Sales' },
  { id: 'pos', icon: Store, label: 'POS', isCenter: true },
  { id: 'contacts', icon: Users, label: 'Contacts' },
  { id: 'more', icon: MoreHorizontal, label: 'More' },
];

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#1F2937] border-t border-[#374151] safe-area-bottom z-50">
      <div className="flex items-center justify-around max-w-md mx-auto px-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          if (tab.isCenter) {
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className="relative -mt-6 flex flex-col items-center justify-center w-14 h-14 rounded-full shadow-lg bg-[#3B82F6] text-white hover:bg-[#2563EB] transition-all"
              >
                <Icon className="w-6 h-6" strokeWidth={2.5} />
              </button>
            );
          }
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="flex flex-col items-center justify-center gap-1 py-3 px-4 min-w-[64px] transition-colors"
            >
              <Icon
                className={`w-6 h-6 ${isActive ? 'text-[#3B82F6]' : 'text-[#9CA3AF]'}`}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span className={`text-xs font-medium ${isActive ? 'text-[#3B82F6]' : 'text-[#9CA3AF]'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
