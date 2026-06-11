'use client';

import React from 'react';
import { AlertTriangle, Info, Pencil } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';

export type TransactionMutationVariant = 'danger' | 'warning' | 'info';

export type TransactionMutationConfirmState = {
  open: boolean;
  variant: TransactionMutationVariant;
  title: string;
  description: string;
  referenceNo?: string;
  amount?: number;
  confirmLabel?: string;
  loading?: boolean;
};

const VARIANT_STYLES: Record<
  TransactionMutationVariant,
  { iconBg: string; iconColor: string; actionClass: string; Icon: typeof AlertTriangle }
> = {
  danger: {
    iconBg: 'bg-red-500/10',
    iconColor: 'text-red-500',
    actionClass: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
    Icon: AlertTriangle,
  },
  warning: {
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-500',
    actionClass: 'bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500',
    Icon: AlertTriangle,
  },
  info: {
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-400',
    actionClass: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
    Icon: Pencil,
  },
};

interface TransactionMutationConfirmDialogProps {
  state: TransactionMutationConfirmState;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export const TransactionMutationConfirmDialog: React.FC<TransactionMutationConfirmDialogProps> = ({
  state,
  onOpenChange,
  onConfirm,
  onCancel,
}) => {
  const styles = VARIANT_STYLES[state.variant];
  const Icon = state.variant === 'info' ? Info : styles.Icon;

  return (
    <AlertDialog open={state.open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-gray-900 border-gray-700 text-white max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div
              className={`h-12 w-12 ${styles.iconBg} rounded-full flex items-center justify-center flex-shrink-0`}
            >
              <Icon className={`${styles.iconColor} h-6 w-6`} />
            </div>
            <AlertDialogTitle className="text-xl font-bold text-white">{state.title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="text-gray-300 space-y-3 pt-2">
              <p className="text-sm leading-relaxed whitespace-pre-line">{state.description}</p>
              {(state.referenceNo || state.amount != null) && (
                <div className="bg-gray-800/50 rounded-lg p-3 space-y-2 text-sm border border-gray-700">
                  {state.referenceNo ? (
                    <div className="flex justify-between gap-4">
                      <span className="text-gray-400 shrink-0">Reference:</span>
                      <span className="text-blue-400 font-mono text-xs text-right">{state.referenceNo}</span>
                    </div>
                  ) : null}
                  {state.amount != null ? (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Amount:</span>
                      <span className="text-white font-semibold">Rs {state.amount.toLocaleString()}</span>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel
            onClick={onCancel}
            disabled={state.loading}
            className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700 focus:ring-gray-600"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={state.loading}
            className={`${styles.actionClass} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {state.loading ? 'Applying…' : state.confirmLabel || 'Haan, karein'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
