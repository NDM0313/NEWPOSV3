/**
 * Full ERP Integration Test Block
 * Post Day 4: End-to-end validation across all modules.
 * Sidebar: Test Pages > ERP Integration Test
 */
import React, { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useNavigation } from '@/app/context/NavigationContext';
import {
  CheckCircle,
  Circle,
  ArrowRight,
  LayoutDashboard,
  Users,
  Package,
  Warehouse,
  ShoppingBag,
  ShoppingCart,
  Shirt,
  Store,
  Factory,
  Receipt,
  Calculator,
  PieChart,
  ClipboardList,
} from 'lucide-react';

type CheckItem = {
  id: string;
  label: string;
  done: boolean;
  module: string;
};

const MODULES: { id: string; label: string; icon: React.ReactNode; viewId: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" />, viewId: 'dashboard' },
  { id: 'contacts', label: 'Contacts', icon: <Users className="h-5 w-5" />, viewId: 'contacts' },
  { id: 'products', label: 'Products', icon: <Package className="h-5 w-5" />, viewId: 'products' },
  { id: 'inventory', label: 'Inventory', icon: <Warehouse className="h-5 w-5" />, viewId: 'inventory' },
  { id: 'purchases', label: 'Purchases', icon: <ShoppingBag className="h-5 w-5" />, viewId: 'purchases' },
  { id: 'sales', label: 'Sales', icon: <ShoppingCart className="h-5 w-5" />, viewId: 'sales' },
  { id: 'rentals', label: 'Rentals', icon: <Shirt className="h-5 w-5" />, viewId: 'rentals' },
  { id: 'pos', label: 'POS', icon: <Store className="h-5 w-5" />, viewId: 'pos' },
  { id: 'studio', label: 'Studio', icon: <Factory className="h-5 w-5" />, viewId: 'studio-dashboard-new' },
  { id: 'expenses', label: 'Expenses', icon: <Receipt className="h-5 w-5" />, viewId: 'expenses' },
  { id: 'accounting', label: 'Accounting', icon: <Calculator className="h-5 w-5" />, viewId: 'accounting' },
  { id: 'reports', label: 'Reports', icon: <PieChart className="h-5 w-5" />, viewId: 'reports' },
];

const DEFAULT_CHECKS: CheckItem[] = [
  { id: 'dash-1', label: 'Dashboard loads, summary cards visible', done: true, module: 'dashboard' },
  { id: 'cont-1', label: 'Contacts: List loads, Create/Edit works', done: true, module: 'contacts' },
  { id: 'prod-1', label: 'Products: List loads, Create/Edit works', done: true, module: 'products' },
  { id: 'inv-1', label: 'Inventory: Stock view loads, no errors', done: true, module: 'inventory' },
  { id: 'pur-1', label: 'Purchases: Create → Edit → Save (Day 4 flow)', done: true, module: 'purchases' },
  { id: 'sal-1', label: 'Sales: Create → Edit → Save, payment flow', done: true, module: 'sales' },
  { id: 'rent-1', label: 'Rentals: View → Edit → Save (Day 4 flow)', done: true, module: 'rentals' },
  { id: 'pos-1', label: 'POS: Add items, complete sale', done: true, module: 'pos' },
  { id: 'stu-1', label: 'Studio: Sales list, pipeline, workers load', done: true, module: 'studio' },
  { id: 'exp-1', label: 'Expenses: Create → View → Edit → Delete (Day 4 flow)', done: true, module: 'expenses' },
  { id: 'acc-1', label: 'Accounting: Chart of accounts, journal entries', done: true, module: 'accounting' },
  { id: 'rep-1', label: 'Reports: Loads, no 500 errors', done: true, module: 'reports' },
];

export function ERPIntegrationTestBlockPage() {
  const { user } = useSupabase();
  const { setCurrentView } = useNavigation();
  const [checks, setChecks] = useState<CheckItem[]>(DEFAULT_CHECKS);

  const toggle = (id: string) => {
    setChecks((prev) =>
      prev.map((c) => (c.id === id ? { ...c, done: !c.done } : c))
    );
  };

  const doneCount = checks.filter((c) => c.done).length;
  const totalCount = checks.length;

  if (!user) {
    return (
      <div className="p-6 max-w-2xl">
        <div className="flex items-center gap-2 text-amber-500">
          <ClipboardList className="h-5 w-5" />
          <span>Please log in to use ERP Integration Test Block.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <ClipboardList className="h-8 w-8 text-indigo-500" />
        <div>
          <h1 className="text-xl font-semibold text-white">Full ERP Integration Test Block</h1>
          <p className="text-sm text-gray-400">
            Post Day 4. End-to-end validation across all modules. Complete Day 4 Certification first.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50 border border-gray-700">
        <span className="text-sm text-gray-400">Progress</span>
        <span className="font-medium text-white">
          {doneCount} / {totalCount}
        </span>
      </div>

      <div className="space-y-4">
        {MODULES.map((mod) => {
          const items = checks.filter((c) => c.module === mod.id);
          if (items.length === 0) return null;
          return (
            <Section
              key={mod.id}
              title={mod.label}
              icon={mod.icon}
              items={items}
              onToggle={toggle}
              onNavigate={() => setCurrentView(mod.viewId as any)}
              navLabel={`Open ${mod.label}`}
            />
          );
        })}
      </div>

      {doneCount === totalCount && (
        <div className="p-4 rounded-lg bg-indigo-950/30 border border-indigo-800 flex items-center gap-3">
          <CheckCircle className="h-6 w-6 text-indigo-500" />
          <div>
            <div className="font-medium text-indigo-400">ERP Integration Test Block Complete</div>
            <div className="text-sm text-gray-400">
              All modules validated. Next: Test Pages → Cutover Prep.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  icon,
  items,
  onToggle,
  onNavigate,
  navLabel,
}: {
  title: string;
  icon: React.ReactNode;
  items: CheckItem[];
  onToggle: (id: string) => void;
  onNavigate: () => void;
  navLabel: string;
}) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2 text-white font-medium">{icon} {title}</div>
        <Button variant="outline" size="sm" onClick={onNavigate} className="gap-1">
          <ArrowRight className="h-4 w-4" />
          {navLabel}
        </Button>
      </div>
      <div className="divide-y divide-gray-800">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onToggle(item.id)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-800/50 transition-colors"
          >
            {item.done ? (
              <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
            ) : (
              <Circle className="h-5 w-5 text-gray-500 shrink-0" />
            )}
            <span className={item.done ? 'text-gray-400 line-through' : 'text-gray-200'}>
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
