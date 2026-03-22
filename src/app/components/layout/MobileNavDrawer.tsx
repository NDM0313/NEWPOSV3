import React, { useState } from 'react';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Settings,
  Store,
  ShoppingBag,
  Shirt,
  Warehouse,
  Receipt,
  Calculator,
  Scale,
  PieChart,
  Factory,
  ChevronDown,
  X,
} from 'lucide-react';
import { useNavigation } from '../../context/NavigationContext';
import { useSettings } from '../../context/SettingsContext';
import { useCheckPermission } from '../../hooks/useCheckPermission';
import { Sheet, SheetContent } from '../ui/sheet';
import { clsx } from 'clsx';

type NavItem = {
  id: string;
  label: string;
  icon: any;
  children?: { id: string; label: string }[];
  isHidden?: boolean;
};

export const MobileNavDrawer = () => {
  const { currentView, setCurrentView, mobileNavOpen, setMobileNavOpen } = useNavigation();
  const { modules: settingsModules, featureFlags, isPermissionLoaded } = useSettings();
  const { hasPermission } = useCheckPermission();
  const studioProductionV2 = featureFlags?.studio_production_v2 === true;
  const studioProductionV3 = featureFlags?.studio_production_v3 === true;
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'contacts', label: 'Contacts', icon: Users, isHidden: !hasPermission('contacts.view') },
    { id: 'products', label: 'Products', icon: Package, isHidden: !hasPermission('products.view') },
    { id: 'inventory', label: 'Inventory', icon: Warehouse, isHidden: !hasPermission('inventory.view') },
    { id: 'purchases', label: 'Purchases', icon: ShoppingBag, isHidden: !hasPermission('purchases.view') },
    { id: 'sales', label: 'Sales', icon: ShoppingCart, isHidden: !hasPermission('sales.view') },
    { id: 'rentals', label: 'Rentals', icon: Shirt, isHidden: !settingsModules.rentalModuleEnabled || !hasPermission('rentals.view') },
    { id: 'pos', label: 'POS System', icon: Store, isHidden: !settingsModules.posModuleEnabled || !hasPermission('pos.view') },
    {
      id: 'studio-group',
      label: 'Studio Production',
      icon: Factory,
      isHidden: (!settingsModules.studioModuleEnabled && !studioProductionV2 && !studioProductionV3) || !hasPermission('studio.view'),
      children: [
        { id: 'studio-dashboard-new', label: 'Dashboard' },
        { id: 'studio', label: 'Studio Sales' },
        { id: 'studio-pipeline', label: 'Production Pipeline' },
        { id: 'studio-workflow', label: 'Workers' },
      ],
    },
    { id: 'expenses', label: 'Expenses', icon: Receipt, isHidden: !hasPermission('expenses.view') },
    { id: 'accounting', label: 'Accounting', icon: Calculator, isHidden: !settingsModules.accountingModuleEnabled || !hasPermission('accounting.view') },
    {
      id: 'ar-ap-reconciliation-center',
      label: 'AR/AP Reconciliation',
      icon: Scale,
      isHidden: !settingsModules.accountingModuleEnabled || !hasPermission('accounting.view'),
    },
    { id: 'reports', label: 'Reports', icon: PieChart, isHidden: !hasPermission('reports.view') },
    { id: 'settings', label: 'Settings', icon: Settings, isHidden: !hasPermission('settings.view') },
  ];

  const visibleItems = navItems.filter((item) => (isPermissionLoaded ? !item.isHidden : item.id === 'dashboard'));

  const handleNavClick = (id: string) => {
    setCurrentView(id as any);
    setMobileNavOpen(false);
  };

  return (
    <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
      <SheetContent
        side="left"
        className="w-[min(320px,85vw)] max-w-full p-0 bg-gray-900 border-gray-800 flex flex-col [&>button]:hidden"
      >
        {/* Header - Figma-style clean */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-blue-900/30">
              E
            </div>
            <span className="font-semibold text-lg text-white tracking-tight">ERP Master</span>
          </div>
          <button
            onClick={() => setMobileNavOpen(false)}
            className="p-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors touch-manipulation"
            aria-label="Close menu"
          >
            <X size={22} strokeWidth={2} />
          </button>
        </div>

        {/* Nav list - touch-friendly, Figma spacing */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {visibleItems.map((item) => {
            const isExpanded = expandedItems.includes(item.id);
            const isActive =
              currentView === item.id || item.children?.some((c) => c.id === currentView);

            if (item.children) {
              return (
                <div key={item.id}>
                  <button
                    onClick={() => toggleExpand(item.id)}
                    className={clsx(
                      'w-full flex items-center justify-between py-3.5 px-4 rounded-xl transition-all min-h-[48px] touch-manipulation',
                      isActive ? 'bg-blue-600/20 text-blue-400' : 'text-gray-300 hover:bg-gray-800/80'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon size={22} strokeWidth={1.5} className="shrink-0" />
                      <span className="font-medium text-base flex items-center gap-1.5">
                        {item.label}
                        {item.id === 'studio-group' && studioProductionV2 && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">V2</span>
                        )}
                      </span>
                    </div>
                    <ChevronDown
                      size={20}
                      className={clsx('text-gray-500 transition-transform', isExpanded && 'rotate-180')}
                    />
                  </button>
                  {isExpanded && (
                    <div className="pl-12 pr-2 py-1 space-y-0.5">
                      {item.children.map((child) => (
                        <button
                          key={child.id}
                          onClick={() => handleNavClick(child.id)}
                          className={clsx(
                            'w-full text-left py-2.5 px-3 rounded-lg text-sm font-medium transition-colors min-h-[44px] touch-manipulation',
                            currentView === child.id
                              ? 'text-blue-400 bg-blue-500/10'
                              : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                          )}
                        >
                          {child.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={clsx(
                  'w-full flex items-center gap-3 py-3.5 px-4 rounded-xl transition-all min-h-[48px] touch-manipulation',
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                    : 'text-gray-300 hover:bg-gray-800/80 hover:text-white'
                )}
              >
                <item.icon size={22} strokeWidth={1.5} className="shrink-0" />
                <span className="font-medium text-base">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
};
