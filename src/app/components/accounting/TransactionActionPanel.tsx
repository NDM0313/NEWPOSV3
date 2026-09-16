'use client';

import React from 'react';
import {
  Edit,
  ExternalLink,
  Eye,
  History,
  MoreVertical,
  Pencil,
  RotateCcw,
  Search,
  Undo2,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { cn } from '@/app/components/ui/utils';
import type { TransactionAction, TransactionActionId } from '@/app/lib/transactionActionRules';

const ACTION_ICONS: Partial<Record<TransactionActionId, React.ComponentType<{ className?: string }>>> = {
  view: Eye,
  edit: Edit,
  cancel_payment: RotateCcw,
  cancel_orphan: RotateCcw,
  cancel_entry: RotateCcw,
  undo_last_change: Undo2,
  open_source_document: ExternalLink,
  view_trace: Search,
  view_audit: History,
};

function severityClasses(action: TransactionAction): string {
  switch (action.id) {
    case 'cancel_payment':
    case 'cancel_entry':
    case 'cancel_orphan':
      return 'text-red-400 hover:text-red-300 hover:bg-red-500/10 disabled:opacity-40';
    case 'undo_last_change':
      return 'text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 disabled:opacity-40';
    case 'edit':
      return 'text-sky-400 hover:text-sky-300 hover:bg-sky-500/10';
    case 'open_source_document':
      return 'text-violet-400 hover:text-violet-300 hover:bg-violet-500/10';
    case 'view_trace':
      return 'text-sky-300 hover:text-sky-200 hover:bg-sky-500/10';
    case 'view_audit':
      return 'text-muted-foreground hover:text-foreground hover:bg-muted/80';
    default:
      return 'text-muted-foreground hover:text-foreground hover:bg-muted/80';
  }
}

function dropdownItemClasses(action: TransactionAction): string {
  switch (action.id) {
    case 'cancel_payment':
    case 'cancel_entry':
    case 'cancel_orphan':
      return 'text-red-400 focus:text-red-300 focus:bg-red-900/20 data-[disabled]:opacity-40';
    case 'undo_last_change':
      return 'text-orange-400 focus:text-orange-300 focus:bg-orange-900/20 data-[disabled]:opacity-40';
    case 'edit':
      return 'text-sky-400 focus:text-sky-300 focus:bg-sky-900/20';
    case 'open_source_document':
      return 'text-violet-400 focus:text-violet-300 focus:bg-violet-900/20';
    case 'view_trace':
      return 'text-sky-300 focus:text-sky-200 focus:bg-sky-900/20';
    default:
      return 'text-gray-200 focus:text-foreground focus:bg-muted';
  }
}

function isDestructiveAction(action: TransactionAction): boolean {
  return (
    action.id === 'cancel_payment' ||
    action.id === 'cancel_entry' ||
    action.id === 'cancel_orphan' ||
    action.id === 'undo_last_change'
  );
}

export interface TransactionActionPanelProps {
  actions: TransactionAction[];
  onAction: (actionId: TransactionActionId) => void;
  disabled?: boolean;
  /** journal row menus use ghost sm; modal footer uses outline sm */
  variant?: 'journal' | 'modal';
  /** inline buttons (journal) vs compact ⋮ menu (roznamcha table) */
  layout?: 'inline' | 'dropdown';
  className?: string;
}

export function TransactionActionPanel({
  actions,
  onAction,
  disabled = false,
  variant = 'journal',
  layout = 'inline',
  className,
}: TransactionActionPanelProps) {
  if (actions.length === 0) return null;

  if (layout === 'dropdown') {
    const firstDestructiveIdx = actions.findIndex(isDestructiveAction);
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              'h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground data-[state=open]:bg-muted',
              className,
            )}
            disabled={disabled}
            title="Actions"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="min-w-[11rem] bg-card border-border text-foreground"
          onClick={(e) => e.stopPropagation()}
        >
          {actions.map((action, idx) => {
            const Icon = ACTION_ICONS[action.id] ?? Pencil;
            const showSeparator =
              firstDestructiveIdx > 0 && idx === firstDestructiveIdx;
            return (
              <React.Fragment key={action.id}>
                {showSeparator ? <DropdownMenuSeparator className="bg-muted" /> : null}
                <DropdownMenuItem
                  className={cn('cursor-pointer', dropdownItemClasses(action))}
                  disabled={disabled || action.disabled}
                  title={action.disabledReason || action.title || action.label}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAction(action.id);
                  }}
                >
                  <Icon className="mr-2 h-4 w-4 shrink-0" />
                  <span>{action.label}</span>
                </DropdownMenuItem>
              </React.Fragment>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

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
                'gap-1 border-gray-600/40 text-muted-foreground',
              isModal && action.severity === 'default' && 'gap-1'
            )}
            disabled={disabled || action.disabled}
            title={action.disabledReason || action.title || action.label}
            onClick={(e) => {
              e.stopPropagation();
              onAction(action.id);
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
