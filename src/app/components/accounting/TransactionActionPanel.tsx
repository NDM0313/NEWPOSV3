'use client';

import React from 'react';
import {
  ArrowLeftRight,
  Edit,
  ExternalLink,
  Eye,
  History,
  Pencil,
  RotateCcw,
  Search,
  Undo2,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/app/components/ui/utils';
import type {
  RegistryActionId,
  RegistryTransactionAction,
} from '@/app/lib/transactionActionsRegistry';
import type { TransactionActionId } from '@/app/lib/transactionActionRules';

const ACTION_ICONS: Partial<
  Record<RegistryActionId, React.ComponentType<{ className?: string }>>
> = {
  view: Eye,
  edit: Edit,
  edit_payment: Edit,
  edit_entry: Pencil,
  edit_transfer: ArrowLeftRight,
  edit_accounts: ArrowLeftRight,
  cancel_payment: RotateCcw,
  cancel_orphan: RotateCcw,
  cancel_entry: RotateCcw,
  reverse_entry: RotateCcw,
  undo_last_change: Undo2,
  open_source_document: ExternalLink,
  view_trace: Search,
  view_audit: History,
};

function severityClasses(action: RegistryTransactionAction): string {
  switch (action.id) {
    case 'cancel_payment':
    case 'cancel_entry':
    case 'reverse_entry':
      return 'text-red-400 hover:text-red-300 hover:bg-red-500/10 disabled:opacity-40';
    case 'undo_last_change':
      return 'text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 disabled:opacity-40';
    case 'edit':
    case 'edit_payment':
    case 'edit_entry':
    case 'edit_transfer':
      return 'text-sky-400 hover:text-sky-300 hover:bg-sky-500/10';
    case 'edit_accounts':
      return 'text-blue-400 hover:text-blue-300 hover:bg-blue-500/10';
    case 'open_source_document':
      return 'text-violet-400 hover:text-violet-300 hover:bg-violet-500/10';
    case 'view_trace':
      return 'text-sky-300 hover:text-sky-200 hover:bg-sky-500/10';
    case 'view_audit':
      return 'text-gray-300 hover:text-white hover:bg-gray-800/80';
    default:
      return 'text-gray-300 hover:text-white hover:bg-gray-800/80';
  }
}

export interface TransactionActionPanelProps {
  actions: RegistryTransactionAction[];
  onAction: (actionId: TransactionActionId | 'edit_accounts') => void;
  disabled?: boolean;
  /** journal row menus use ghost sm; modal footer uses outline sm */
  variant?: 'journal' | 'modal';
  className?: string;
}

export function TransactionActionPanel({
  actions,
  onAction,
  disabled = false,
  variant = 'journal',
  className,
}: TransactionActionPanelProps) {
  if (actions.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap items-center gap-1 max-w-full', className)}>
      {actions.map((action) => {
        const Icon = ACTION_ICONS[action.id] ?? Pencil;
        const isModal = variant === 'modal';
        return (
          <Button
            key={action.id}
            type="button"
            variant={isModal ? 'outline' : 'ghost'}
            size="sm"
            className={cn(
              isModal ? 'gap-1 h-8 shrink-0' : 'h-8',
              !isModal && severityClasses(action),
              isModal &&
                action.severity === 'destructive' &&
                'gap-1 border-red-500/40 text-red-300',
              isModal &&
                action.severity === 'secondary' &&
                'gap-1 border-gray-600/40 text-gray-300',
              isModal && action.severity === 'default' && 'gap-1',
              isModal &&
                action.id === 'edit_accounts' &&
                'gap-1 border-blue-500/40 text-blue-300'
            )}
            disabled={disabled || action.disabled}
            title={action.disabledReason || action.title || action.label}
            onClick={(e) => {
              e.stopPropagation();
              onAction(action.handlerId);
            }}
          >
            <Icon className={cn('shrink-0', isModal ? 'w-3.5 h-3.5' : 'w-4 h-4 mr-1')} />
            {action.label}
          </Button>
        );
      })}
    </div>
  );
}
