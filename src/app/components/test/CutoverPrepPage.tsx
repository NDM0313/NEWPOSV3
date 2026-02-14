/**
 * Cutover Prep – Final checklist before go-live
 * Post ERP Integration Test Block. Tracks pre-cutover and cutover phases.
 * Sidebar: Test Pages > Cutover Prep
 */
import React, { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useNavigation } from '@/app/context/NavigationContext';
import {
  CheckCircle,
  Circle,
  ArrowRight,
  Shield,
  ClipboardCheck,
  Calendar,
  Database,
  FileText,
  Rocket,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

type CheckItem = {
  id: string;
  label: string;
  done: boolean;
  phase: 'pre' | 'freeze' | 'sync' | 'validation' | 'golive';
};

const PRE_CHECKS: CheckItem[] = [
  { id: 'pre-1', label: 'Day 4 Certification complete', done: true, phase: 'pre' },
  { id: 'pre-2', label: 'ERP Integration Test Block complete', done: true, phase: 'pre' },
  { id: 'pre-3', label: 'RLS validated (all 5 steps)', done: true, phase: 'pre' },
  { id: 'pre-4', label: 'Backup of current production data', done: true, phase: 'pre' },
  { id: 'pre-5', label: 'Cutover window scheduled (date/time)', done: true, phase: 'pre' },
  { id: 'pre-6', label: 'Rollback plan documented', done: true, phase: 'pre' },
];

const CUTOVER_PHASES = [
  {
    id: 'freeze',
    title: 'Phase 1 – Freeze (T-30 min)',
    icon: <Calendar className="h-5 w-5" />,
    items: [
      'Announce freeze to users',
      'No new transactions in legacy system (if applicable)',
      'Final data export from legacy (if migrating)',
    ],
  },
  {
    id: 'sync',
    title: 'Phase 2 – Data Sync (T-0 to T+2h)',
    icon: <Database className="h-5 w-5" />,
    items: [
      'Run migration scripts (if any)',
      'Verify public.users ↔ auth.users mapping',
      'Verify company_id on all scoped tables',
      'Run DAY4_QUICK_VERIFICATION.sql',
    ],
  },
  {
    id: 'validation',
    title: 'Phase 3 – Validation (T+2h to T+4h)',
    icon: <Shield className="h-5 w-5" />,
    items: [
      'Login as each company admin',
      'RLS Validation page – all steps pass',
      'Day 4 flows: Purchases, Rentals, Expenses',
      'ERP Integration: Sales, Accounting, Reports',
      'No console errors, no 500s',
    ],
  },
  {
    id: 'golive',
    title: 'Phase 4 – Go-Live (T+4h)',
    icon: <Rocket className="h-5 w-5" />,
    items: [
      'Enable access for all users',
      'Monitor Supabase logs (first 24h)',
      'Support channel ready for issues',
    ],
  },
];

export function CutoverPrepPage() {
  const { user } = useSupabase();
  const { setCurrentView } = useNavigation();
  const [checks, setChecks] = useState<CheckItem[]>(PRE_CHECKS);
  const [expandedPhase, setExpandedPhase] = useState<string | null>('freeze');

  const toggle = (id: string) => {
    setChecks((prev) =>
      prev.map((c) => (c.id === id ? { ...c, done: !c.done } : c))
    );
  };

  const preDone = checks.filter((c) => c.phase === 'pre' && c.done).length;
  const preTotal = checks.filter((c) => c.phase === 'pre').length;

  if (!user) {
    return (
      <div className="p-6 max-w-2xl">
        <div className="flex items-center gap-2 text-amber-500">
          <Rocket className="h-5 w-5" />
          <span>Please log in to use Cutover Prep.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Rocket className="h-8 w-8 text-amber-500" />
        <div>
          <h1 className="text-xl font-semibold text-white">Cutover Prep</h1>
          <p className="text-sm text-gray-400">
            Final checklist before go-live. Complete pre-cutover, then execute phases during cutover window.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50 border border-gray-700">
        <span className="text-sm text-gray-400">Pre-Cutover</span>
        <span className="font-medium text-white">
          {preDone} / {preTotal}
        </span>
      </div>

      <div className="rounded-lg border border-gray-800 bg-gray-900/50 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2 text-white font-medium">
            <ClipboardCheck className="h-5 w-5" />
            Pre-Cutover Checklist
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentView('day4-certification')}
              className="gap-1"
            >
              Day 4
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentView('erp-integration-test')}
              className="gap-1"
            >
              ERP Test
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentView('rls-validation')}
              className="gap-1"
            >
              RLS
            </Button>
          </div>
        </div>
        <div className="divide-y divide-gray-800">
          {checks.filter((c) => c.phase === 'pre').map((item) => (
            <button
              key={item.id}
              onClick={() => toggle(item.id)}
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

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-gray-400">Cutover Window Phases</h2>
        {CUTOVER_PHASES.map((phase) => (
          <div
            key={phase.id}
            className="rounded-lg border border-gray-800 bg-gray-900/50 overflow-hidden"
          >
            <button
              onClick={() => setExpandedPhase(expandedPhase === phase.id ? null : phase.id)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center gap-2 text-white font-medium">
                {phase.icon} {phase.title}
              </div>
              {expandedPhase === phase.id ? (
                <ChevronUp className="h-5 w-5 text-gray-500" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-500" />
              )}
            </button>
            {expandedPhase === phase.id && (
              <div className="border-t border-gray-800 px-4 py-3 space-y-2">
                {phase.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-gray-400">
                    <Circle className="h-4 w-4 text-gray-600 shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {preDone === preTotal && (
        <div className="p-4 rounded-lg bg-amber-950/30 border border-amber-800 flex items-center gap-3">
          <Rocket className="h-6 w-6 text-amber-500" />
          <div>
            <div className="font-medium text-amber-400">Ready for Cutover</div>
            <div className="text-sm text-gray-400">
              Pre-cutover complete. Schedule cutover window and execute phases. See CUTOVER_PLANNING.md.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
