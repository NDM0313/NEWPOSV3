'use client';

import React, { useCallback, useRef, useState } from 'react';
import {
  TransactionMutationConfirmDialog,
  type TransactionMutationConfirmState,
  type TransactionMutationVariant,
} from '@/app/components/accounting/TransactionMutationConfirmDialog';

export type TransactionMutationAction =
  | 'reverse'
  | 'void'
  | 'void_reversal'
  | 'undo_payment_edit'
  | 'cancel_payment_chain'
  | 'start_edit'
  | 'save_edit'
  | 'save_payment_edit';

export type RequestTransactionConfirmOptions = {
  action: TransactionMutationAction;
  referenceNo?: string;
  amount?: number;
  /** Override preset title/description */
  title?: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
};

const ACTION_PRESETS: Record<
  TransactionMutationAction,
  { variant: TransactionMutationVariant; title: string; description: string; confirmLabel?: string }
> = {
  reverse: {
    variant: 'warning',
    title: 'Reverse journal entry?',
    description:
      'Reversal entry post hogi jo original ko offset karegi. Ye GL aur reports mein nayi correction row banayegi. Continue?',
    confirmLabel: 'Haan, reverse karein',
  },
  void: {
    variant: 'danger',
    title: 'Void / Cancel entry?',
    description:
      'Kya aap is entry ko VOID/CANCEL karna chahte hain? Ye GL, reports aur balances se hat jayegi. Is action ko undo nahi kiya ja sakta.',
    confirmLabel: 'Haan, void karein',
  },
  void_reversal: {
    variant: 'danger',
    title: 'Void reversal entry?',
    description:
      'Kya aap is reversal entry ko VOID karna chahte hain? Ye GL aur reports se hat jayegi. Original JE voided reh sakti hai. Undo nahi ho sakta.',
    confirmLabel: 'Haan, void karein',
  },
  undo_payment_edit: {
    variant: 'warning',
    title: 'Undo last payment edit?',
    description:
      'Undo the last edit on this payment? This voids the latest adjustment and restores the previous state.',
    confirmLabel: 'Haan, undo karein',
  },
  cancel_payment_chain: {
    variant: 'danger',
    title: 'Cancel full payment?',
    description:
      'Cancel this payment entirely? This voids the original posting plus every edit in the chain. Cannot be undone.',
    confirmLabel: 'Haan, cancel karein',
  },
  start_edit: {
    variant: 'info',
    title: 'Edit transaction?',
    description: 'Kya aap is entry ko edit karna chahte hain? Editor open hoga — save par changes GL par apply hongi.',
    confirmLabel: 'Haan, edit karein',
  },
  save_edit: {
    variant: 'info',
    title: 'Save changes?',
    description: 'Changes save hongi aur GL / ledger update hoga. Kya aap save karna chahte hain?',
    confirmLabel: 'Haan, save karein',
  },
  save_payment_edit: {
    variant: 'info',
    title: 'Update payment?',
    description:
      'Payment update hogi aur linked journal adjust ho sakta hai. Kya aap ye changes apply karna chahte hain?',
    confirmLabel: 'Haan, update karein',
  },
};

const CLOSED_STATE: TransactionMutationConfirmState = {
  open: false,
  variant: 'warning',
  title: '',
  description: '',
};

export function useTransactionMutationConfirm() {
  const [state, setState] = useState<TransactionMutationConfirmState>(CLOSED_STATE);
  const pendingConfirmRef = useRef<(() => void | Promise<void>) | null>(null);

  const close = useCallback(() => {
    pendingConfirmRef.current = null;
    setState(CLOSED_STATE);
  }, []);

  const requestConfirm = useCallback((options: RequestTransactionConfirmOptions) => {
    const preset = ACTION_PRESETS[options.action];
    pendingConfirmRef.current = options.onConfirm;
    setState({
      open: true,
      variant: preset.variant,
      title: options.title ?? preset.title,
      description: options.description ?? preset.description,
      referenceNo: options.referenceNo,
      amount: options.amount,
      confirmLabel: options.confirmLabel ?? preset.confirmLabel,
      loading: false,
    });
  }, []);

  const handleConfirm = useCallback(async () => {
    const fn = pendingConfirmRef.current;
    if (!fn) {
      close();
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    try {
      await fn();
      close();
    } catch {
      setState((s) => ({ ...s, loading: false }));
    }
  }, [close]);

  const ConfirmDialog = useCallback(
    () => (
      <TransactionMutationConfirmDialog
        state={state}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        onConfirm={() => void handleConfirm()}
        onCancel={close}
      />
    ),
    [state, close, handleConfirm]
  );

  return { requestConfirm, ConfirmDialog, close };
}
