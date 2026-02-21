import { Home, ShoppingCart, Store, Users, MoreHorizontal } from 'lucide-react';

interface BottomNavProps {
  activeTab: 'home' | 'sales' | 'pos' | 'contacts' | 'more';
  onTabChange: (tab: 'home' | 'sales' | 'pos' | 'contacts' | 'more') => void;
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const tabs = [
    { id: 'home' as const, icon: Home, label: 'Home' },
    { id: 'sales' as const, icon: ShoppingCart, label: 'Sales' },
    { id: 'pos' as const, icon: Store, label: 'POS', isCenter: true },
    { id: 'contacts' as const, icon: Users, label: 'Contacts' },
    { id: 'more' as const, icon: MoreHorizontal, label: 'More' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#1F2937] border-t border-[#374151] safe-area-bottom z-50">
      <div className="flex items-center justify-around max-w-md mx-auto px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const isCenter = tab.isCenter;

          if (isCenter) {
            // POS button - larger and centered
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`relative -mt-6 flex flex-col items-center justify-center w-14 h-14 rounded-full shadow-lg transition-all ${
                  isActive
                    ? 'bg-[#3B82F6] text-white'
                    : 'bg-[#3B82F6] text-white hover:bg-[#2563EB]'
                }`}
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
                className={`w-6 h-6 transition-colors ${
                  isActive ? 'text-[#3B82F6]' : 'text-[#9CA3AF]'
                }`}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span
                className={`text-xs font-medium transition-colors ${
                  isActive ? 'text-[#3B82F6]' : 'text-[#9CA3AF]'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
