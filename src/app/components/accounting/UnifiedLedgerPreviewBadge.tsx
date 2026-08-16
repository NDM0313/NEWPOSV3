import React from 'react';
import { Badge } from '@/app/components/ui/badge';
import type { UnifiedLedgerEngineMode } from '@/app/lib/unifiedLedgerEngineState';

const BADGE_LABEL: Partial<Record<UnifiedLedgerEngineMode, string>> = {
  preview: 'Preview',
  legacy: 'Legacy',
  unified: 'Unified',
  killed: 'Killed',
  disabled: 'OFF',
};

const BADGE_VARIANT: Partial<
  Record<UnifiedLedgerEngineMode, 'default' | 'secondary' | 'destructive' | 'outline'>
> = {
  preview: 'secondary',
  legacy: 'outline',
  unified: 'default',
  killed: 'destructive',
  disabled: 'outline',
};

export function UnifiedLedgerPreviewBadge(props: { mode: UnifiedLedgerEngineMode }) {
  const label = BADGE_LABEL[props.mode] ?? 'Legacy';
  const variant = BADGE_VARIANT[props.mode] ?? 'outline';
  return (
    <Badge variant={variant} data-unified-ledger-badge={props.mode}>
      {label}
    </Badge>
  );
}
