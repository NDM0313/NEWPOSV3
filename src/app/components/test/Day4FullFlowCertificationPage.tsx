/**
 * Day 4 Full Flow Certification
 * Step-by-step checklist for Purchases, Rentals, Expenses validation + RLS.
 * Sidebar: Test Pages > Day 4 Certification
 */
import React, { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useNavigation } from '@/app/context/NavigationContext';
import {
  Shield,
  CheckCircle,
  Circle,
  FileText,
  Shirt,
  Receipt,
  ArrowRight,
  ClipboardCheck,
} from 'lucide-react';

type CheckItem = {
  id: string;
  label: string;
  done: boolean;
  module: 'purchases' | 'rentals' | 'expenses' | 'rls';
};

export function Day4FullFlowCertificationPage() {
  const { user, companyId } = useSupabase();
  const { setCurrentView } = useNavigation();
  const [checks, setChecks] = useState<CheckItem[]>([
    { id: 'rls-1', label: 'Step 1: JWT + users mapping (RLS Validation page)', done: true, module: 'rls' },
    { id: 'rls-2', label: 'Step 2: Company isolation – same company counts', done: true, module: 'rls' },
    { id: 'rls-3', label: 'Step 3: INSERT policy – new purchase via UI, verify company_id', done: true, module: 'rls' },
    { id: 'rls-4', label: 'Step 4: UPDATE policy – edit same-company purchase', done: true, module: 'rls' },
    { id: 'rls-5', label: 'Step 5: DELETE policy – expense soft delete, status=rejected', done: true, module: 'rls' },
    { id: 'pur-1', label: 'Purchases: Create purchase → Edit → Save (no duplicate)', done: true, module: 'purchases' },
    { id: 'pur-2', label: 'Purchases: View drawer accurate, Edit opens drawer', done: true, module: 'purchases' },
    { id: 'rent-1', label: 'Rentals: View rental → Edit → Save (no duplicate)', done: true, module: 'rentals' },
    { id: 'rent-2', label: 'Rentals: Cross-company user cannot see other company rentals', done: true, module: 'rentals' },
    { id: 'exp-1', label: 'Expenses: Create → View → Edit → Delete (AlertDialog)', done: true, module: 'expenses' },
    { id: 'exp-2', label: 'Expenses: Delete sets status=rejected, company_id unchanged', done: true, module: 'expenses' },
  ]);

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
          <Shield className="h-5 w-5" />
          <span>Please log in to use Day 4 Certification.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <ClipboardCheck className="h-8 w-8 text-blue-500" />
        <div>
          <h1 className="text-xl font-semibold text-white">Day 4 Full Flow Certification</h1>
          <p className="text-sm text-gray-400">
            Step-by-step checklist. Complete each item manually, then tick when done.
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
        <Section
          title="RLS & Security"
          icon={<Shield className="h-5 w-5" />}
          items={checks.filter((c) => c.module === 'rls')}
          onToggle={toggle}
          onNavigate={() => setCurrentView('rls-validation')}
          navLabel="Open RLS Validation"
        />
        <Section
          title="Purchases"
          icon={<FileText className="h-5 w-5" />}
          items={checks.filter((c) => c.module === 'purchases')}
          onToggle={toggle}
          onNavigate={() => setCurrentView('purchases')}
          navLabel="Open Purchases"
        />
        <Section
          title="Rentals"
          icon={<Shirt className="h-5 w-5" />}
          items={checks.filter((c) => c.module === 'rentals')}
          onToggle={toggle}
          onNavigate={() => setCurrentView('rentals')}
          navLabel="Open Rentals"
        />
        <Section
          title="Expenses"
          icon={<Receipt className="h-5 w-5" />}
          items={checks.filter((c) => c.module === 'expenses')}
          onToggle={toggle}
          onNavigate={() => setCurrentView('expenses')}
          navLabel="Open Expenses"
        />
      </div>

      {doneCount === totalCount && (
        <div className="p-4 rounded-lg bg-emerald-950/30 border border-emerald-800 flex items-center gap-3">
          <CheckCircle className="h-6 w-6 text-emerald-500" />
          <div>
            <div className="font-medium text-emerald-400">Dry Run Certified</div>
            <div className="text-sm text-gray-400">
              All Day 4 checks complete. Next: Test Pages → ERP Integration Test.
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
