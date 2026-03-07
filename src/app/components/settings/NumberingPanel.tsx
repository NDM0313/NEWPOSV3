/**
 * Settings → Numbering: Rules, Maintenance, Audit (Admin/Owner only).
 * Permission-gated. Sub-tab driven by parent (effectiveSubTab) or internal state.
 */

import React, { useState } from 'react';
import { Hash, Lock } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { NumberingRulesTable } from './NumberingRulesTable';
import { NumberingMaintenanceTable } from './NumberingMaintenanceTable';
import { NumberAuditTable } from './NumberAuditTable';

export type NumberingInnerTab = 'rules' | 'maintenance' | 'audit';

export function NumberingPanel({
  isAdminOrOwner,
  activeSubTab,
}: {
  isAdminOrOwner: boolean;
  /** When set, parent controls which sub-tab is shown (e.g. from Settings left sidebar). */
  activeSubTab?: NumberingInnerTab;
}) {
  const [innerTab, setInnerTab] = useState<NumberingInnerTab>('rules');
  const tab = activeSubTab ?? innerTab;

  if (!isAdminOrOwner) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-cyan-500/10 rounded-lg">
            <Hash className="text-cyan-500" size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Numbering</h3>
            <p className="text-sm text-gray-400">Rules, sequence sync, and audit log</p>
          </div>
        </div>
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-8 flex flex-col items-center justify-center gap-4 min-h-[200px]">
          <Lock className="w-12 h-12 text-amber-400" />
          <p className="text-amber-200 font-medium">Access restricted</p>
          <p className="text-gray-400 text-sm text-center max-w-md">
            Numbering rules, maintenance, and audit log are available only to Admin or Owner.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-3 bg-cyan-500/10 rounded-lg">
          <Hash className="text-cyan-500" size={24} />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">Numbering</h3>
          <p className="text-sm text-gray-400">Rules, sequence sync, and audit log</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-b border-gray-800 pb-4">
        <Button
          variant={tab === 'rules' ? 'default' : 'ghost'}
          size="sm"
          className={tab === 'rules' ? 'bg-cyan-600 hover:bg-cyan-500' : 'text-gray-400 hover:text-white'}
          onClick={() => setInnerTab('rules')}
        >
          Numbering Rules
        </Button>
        <Button
          variant={tab === 'maintenance' ? 'default' : 'ghost'}
          size="sm"
          className={tab === 'maintenance' ? 'bg-cyan-600 hover:bg-cyan-500' : 'text-gray-400 hover:text-white'}
          onClick={() => setInnerTab('maintenance')}
        >
          Numbering Maintenance
        </Button>
        <Button
          variant={tab === 'audit' ? 'default' : 'ghost'}
          size="sm"
          className={tab === 'audit' ? 'bg-cyan-600 hover:bg-cyan-500' : 'text-gray-400 hover:text-white'}
          onClick={() => setInnerTab('audit')}
        >
          Number Audit Log
        </Button>
      </div>
      {tab === 'rules' && <NumberingRulesTable />}
      {tab === 'maintenance' && <NumberingMaintenanceTable />}
      {tab === 'audit' && <NumberAuditTable />}
    </div>
  );
}
