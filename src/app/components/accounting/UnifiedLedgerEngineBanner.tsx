import React from 'react';
import type { UnifiedLedgerEngineMode } from '@/app/lib/unifiedLedgerEngineState';
import type { UnifiedLedgerScreenId } from '@/app/lib/unifiedLedgerScreenFlags';

const MODE_STYLES: Record<UnifiedLedgerEngineMode, string> = {
  legacy: 'border-gray-600/50 bg-gray-900/50 text-gray-200',
  disabled: 'border-gray-700/50 bg-gray-900/40 text-gray-400',
  preview: 'border-amber-500/40 bg-amber-500/[0.08] text-amber-100/95',
  unified: 'border-emerald-500/40 bg-emerald-500/[0.08] text-emerald-100/95',
  killed: 'border-red-500/50 bg-red-500/[0.1] text-red-100/95',
};

const MODE_COPY: Record<UnifiedLedgerEngineMode, string> = {
  legacy: 'Legacy ledger engine — production default',
  disabled: 'Unified engine OFF',
  preview: 'Unified preview — compare only; not the default view',
  unified: 'Unified engine active for this screen',
  killed: 'Unified engine disabled by administrator — legacy only',
};

export function UnifiedLedgerEngineBanner(props: {
  mode: UnifiedLedgerEngineMode;
  screenId?: UnifiedLedgerScreenId;
  className?: string;
}) {
  const { mode, screenId, className = '' } = props;
  return (
    <div
      className={`rounded-lg border px-3 py-2 text-sm ${MODE_STYLES[mode]} ${className}`}
      role="note"
      data-unified-ledger-mode={mode}
      data-unified-ledger-screen={screenId ?? ''}
    >
      <strong className="font-semibold">Ledger engine</strong>
      <span className="text-inherit/85"> — {MODE_COPY[mode]}</span>
      {screenId ? (
        <span className="text-inherit/60 text-xs ml-2">({screenId})</span>
      ) : null}
    </div>
  );
}
