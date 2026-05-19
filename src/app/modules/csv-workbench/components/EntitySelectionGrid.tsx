/**
 * Checkbox grid for selective restore entities.
 */

import React from 'react';
import { Checkbox } from '@/app/components/ui/checkbox';
import { BACKUP_ENTITY_DEFINITIONS } from '../backupPackage/backupEntityRegistry';
import type { BackupEntityKey, BackupPackageFiles } from '../backupPackage/types';
import { countRowsInCsv } from '../backupPackage/parseBackupPackage';

export interface EntitySelectionGridProps {
  files: BackupPackageFiles;
  selected: Set<BackupEntityKey>;
  onChange: (next: Set<BackupEntityKey>) => void;
  disabled?: boolean;
}

export function EntitySelectionGrid({
  files,
  selected,
  onChange,
  disabled,
}: EntitySelectionGridProps) {
  const toggle = (key: BackupEntityKey, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(key);
    else next.delete(key);
    onChange(next);
  };

  return (
    <div className="w-full overflow-x-auto text-sm">
      <table className="w-full border-collapse min-w-[520px]">
        <thead>
          <tr className="border-b border-gray-700 text-left text-gray-400">
            <th className="py-2 pr-2 w-10" />
            <th className="py-2 pr-4">Entity</th>
            <th className="py-2 pr-4">Phase</th>
            <th className="py-2 pr-4">Rows</th>
            <th className="py-2">Import</th>
          </tr>
        </thead>
        <tbody>
          {BACKUP_ENTITY_DEFINITIONS.map((def) => {
            const rowCount = countRowsInCsv(files[def.key]);
            const checked = selected.has(def.key);
            const hasFile = files[def.key] !== undefined;
            return (
              <tr
                key={def.key}
                className="border-b border-gray-800/80 hover:bg-gray-900/50"
              >
                <td className="py-2 pr-2">
                  <Checkbox
                    checked={checked}
                    disabled={disabled || !hasFile}
                    onCheckedChange={(v) => toggle(def.key, v === true)}
                    aria-label={`Select ${def.label}`}
                  />
                </td>
                <td className="py-2 pr-4 text-white">
                  {def.label}
                  {def.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{def.description}</p>
                  )}
                </td>
                <td className="py-2 pr-4 text-gray-400">Phase {def.phase}</td>
                <td className="py-2 pr-4 text-gray-300 tabular-nums">{rowCount}</td>
                <td className="py-2">
                  {def.commitImplemented ? (
                    <span className="text-emerald-400 text-xs">Ready</span>
                  ) : (
                    <span className="text-amber-400 text-xs">Audit only</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
