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
      className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground flex flex-wrap gap-x-6 gap-y-1"
      role="status"
    >
      {statementLabel ? (
        <span>
          <span className="text-muted-foreground">Statement:</span> {statementLabel}
        </span>
      ) : null}
      <span>
        <span className="text-muted-foreground">Period:</span> {periodLabel}
      </span>
      <span>
        <span className="text-muted-foreground">Branch scope:</span> {branchScopeLabel}
      </span>
      <span>
        <span className="text-muted-foreground">Basis:</span> {basisLabel}
      </span>
    </div>
  );
};
