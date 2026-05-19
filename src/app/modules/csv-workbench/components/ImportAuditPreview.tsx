/**
 * Audit summary table before restore commit.
 */

import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { RestoreAuditResult } from '../backupPackage/types';
import { BACKUP_ENTITY_BY_KEY } from '../backupPackage/backupEntityRegistry';

export interface ImportAuditPreviewProps {
  audit: RestoreAuditResult | null;
}

export function ImportAuditPreview({ audit }: ImportAuditPreviewProps) {
  if (!audit) {
    return <p className="text-sm text-gray-400">Run audit to see validation results.</p>;
  }

  const canCommit = audit.blocking.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {canCommit ? (
          <>
            <CheckCircle2 className="text-emerald-500" size={20} />
            <span className="text-emerald-400 font-medium">
              Audit passed — ready to import Phase 1 entities
            </span>
          </>
        ) : (
          <>
            <AlertCircle className="text-red-400" size={20} />
            <span className="text-red-400 font-medium">
              {audit.blocking.length} blocking issue(s) — fix selection or data before import
            </span>
          </>
        )}
      </div>

      {audit.entitySummaries.length > 0 && (
        <table className="w-full text-sm border border-gray-800 rounded-lg overflow-hidden">
          <thead className="bg-gray-900 text-gray-400">
            <tr>
              <th className="text-left py-2 px-3">Entity</th>
              <th className="text-right py-2 px-3">Rows</th>
              <th className="text-left py-2 px-3">Parse</th>
              <th className="text-left py-2 px-3">Commit</th>
            </tr>
          </thead>
          <tbody>
            {audit.entitySummaries.map((s) => (
              <tr key={s.key} className="border-t border-gray-800">
                <td className="py-2 px-3 text-white">
                  {BACKUP_ENTITY_BY_KEY[s.key]?.label ?? s.key}
                </td>
                <td className="py-2 px-3 text-right text-gray-300 tabular-nums">{s.rowCount}</td>
                <td className="py-2 px-3">
                  {s.parseOk ? (
                    <span className="text-emerald-400 text-xs">OK</span>
                  ) : (
                    <span className="text-red-400 text-xs">Error</span>
                  )}
                </td>
                <td className="py-2 px-3 text-xs text-gray-400">
                  {s.commitImplemented ? 'Implemented' : 'Audit only'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {audit.blocking.length > 0 && (
        <ul className="space-y-1 text-sm text-red-300">
          {audit.blocking.map((issue, i) => (
            <li key={`b-${i}`} className="flex gap-2">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              {issue.message}
            </li>
          ))}
        </ul>
      )}

      {audit.warnings.length > 0 && (
        <ul className="space-y-1 text-sm text-amber-300/90">
          {audit.warnings.map((issue, i) => (
            <li key={`w-${i}`} className="flex gap-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              {issue.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
