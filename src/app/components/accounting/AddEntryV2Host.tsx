'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AddEntryV2, type AddEntryV2Type } from '@/app/components/accounting/AddEntryV2';

export type AddEntryV2Origin = 'account_ledger' | 'accounting';

export type OpenAddEntryV2Detail = {
  entryType?: AddEntryV2Type;
  editJournalEntryId?: string;
  fromAccountId?: string;
  toAccountId?: string;
  origin?: AddEntryV2Origin;
};

export function dispatchOpenAddEntryV2(detail: OpenAddEntryV2Detail = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('openAddEntryV2', { detail }));
}

export interface AddEntryV2HostProps {
  onRecorded?: () => void | Promise<void>;
}

export function AddEntryV2Host({ onRecorded }: AddEntryV2HostProps) {
  const [open, setOpen] = useState(false);
  const [initialEntryType, setInitialEntryType] = useState<AddEntryV2Type | undefined>();
  const [editJournalEntryId, setEditJournalEntryId] = useState<string | undefined>();
  const [initialFromAccountId, setInitialFromAccountId] = useState<string | undefined>();
  const [initialToAccountId, setInitialToAccountId] = useState<string | undefined>();
  const [origin, setOrigin] = useState<AddEntryV2Origin | undefined>();

  const reset = useCallback(() => {
    setOpen(false);
    setInitialEntryType(undefined);
    setEditJournalEntryId(undefined);
    setInitialFromAccountId(undefined);
    setInitialToAccountId(undefined);
    setOrigin(undefined);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const d = ((event as CustomEvent).detail || {}) as OpenAddEntryV2Detail;
      setInitialEntryType(d.entryType);
      setEditJournalEntryId(d.editJournalEntryId);
      setInitialFromAccountId(d.fromAccountId);
      setInitialToAccountId(d.toAccountId);
      setOrigin(d.origin);
      setOpen(true);
    };
    window.addEventListener('openAddEntryV2', handler as EventListener);
    return () => window.removeEventListener('openAddEntryV2', handler as EventListener);
  }, []);

  if (!open) return null;

  return (
    <AddEntryV2
      initialEntryType={initialEntryType}
      editJournalEntryId={editJournalEntryId}
      initialFromAccountId={initialFromAccountId}
      initialToAccountId={initialToAccountId}
      onClose={reset}
      onRecorded={onRecorded}
    />
  );
}
