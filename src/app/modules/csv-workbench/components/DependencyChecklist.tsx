/**
 * Ordered dependency phases with checkmarks for restore wizard.
 */

import React from 'react';
import { Check, Circle, AlertTriangle } from 'lucide-react';
import { computeImportOrder, validateRestoreSelection } from '../backupPackage/dependencyGraph';
import { BACKUP_ENTITY_BY_KEY } from '../backupPackage/backupEntityRegistry';
import type { BackupEntityKey } from '../backupPackage/types';

export interface DependencyChecklistProps {
  selected: Set<BackupEntityKey>;
  onAddDependencies?: (keys: BackupEntityKey[]) => void;
}

export function DependencyChecklist({ selected, onAddDependencies }: DependencyChecklistProps) {
  const order = computeImportOrder(selected);
  const validation = validateRestoreSelection(selected);

  const phases: Array<{ phase: 1 | 2 | 3; label: string }> = [
    { phase: 1, label: 'Phase 1 — Core masters & stock' },
    { phase: 2, label: 'Phase 2 — Operational documents' },
    { phase: 3, label: 'Phase 3 — Rental payments' },
  ];

  return (
    <div className="space-y-4">
      {phases.map(({ phase, label }) => {
        const items = order.filter((k) => BACKUP_ENTITY_BY_KEY[k]?.phase === phase);
        if (!items.length) return null;
        return (
          <div key={phase} className="border border-gray-800 rounded-lg p-4">
            <h4 className="text-white font-medium mb-3 text-sm">{label}</h4>
            <ul className="space-y-2">
              {items.map((key) => {
                const def = BACKUP_ENTITY_BY_KEY[key];
                return (
                  <li key={key} className="flex items-center gap-2 text-sm text-gray-300">
                    <Check className="text-emerald-500 shrink-0" size={16} />
                    <span>{def.label}</span>
                    {!def.commitImplemented && (
                      <span className="text-xs text-amber-400">(audit only)</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      {order.length === 0 && (
        <p className="text-sm text-gray-500 flex items-center gap-2">
          <Circle size={14} />
          Select entities above to see import order.
        </p>
      )}

      {!validation.ok && (
        <div className="rounded-lg border border-amber-700/50 bg-amber-950/20 p-3 space-y-2">
          <p className="text-sm text-amber-300 flex items-center gap-2">
            <AlertTriangle size={16} />
            Missing dependencies
          </p>
          <ul className="text-xs text-amber-200/90 space-y-1 ml-6 list-disc">
            {validation.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
          {onAddDependencies && validation.suggestedAdds.length > 0 && (
            <button
              type="button"
              className="text-xs text-amber-400 underline hover:text-amber-300"
              onClick={() => onAddDependencies(validation.suggestedAdds)}
            >
              Add required parent entities
            </button>
          )}
        </div>
      )}
    </div>
  );
}
