import React from 'react';

/**
 * Visible scope strip for statement-style reports: period, branch interpretation, audit vs effective basis.
 */
export const StatementScopeBanner: React.FC<{
  periodLabel: string;
  branchScopeLabel: string;
  basisLabel: string;
  statementLabel?: string;
}> = ({ periodLabel, branchScopeLabel, basisLabel, statementLabel }) => {
  return (
    <div
      className="rounded-lg border border-gray-800 bg-gray-950/50 px-3 py-2 text-xs text-gray-400 flex flex-wrap gap-x-6 gap-y-1"
      role="status"
    >
      {statementLabel ? (
        <span>
          <span className="text-gray-500">Statement:</span> {statementLabel}
        </span>
      ) : null}
      <span>
        <span className="text-gray-500">Period:</span> {periodLabel}
      </span>
      <span>
        <span className="text-gray-500">Branch scope:</span> {branchScopeLabel}
      </span>
      <span>
        <span className="text-gray-500">Basis:</span> {basisLabel}
      </span>
    </div>
  );
};
