import React from 'react';
import {
  ArrowLeftRight,
  BarChart3,
  CheckCircle2,
  Copy,
  Edit,
  Eye,
  FileText,
  FolderPlus,
  List,
  MoreVertical,
  Scale,
  ShieldAlert,
  Star,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { getControlAccountKind } from '@/app/lib/accountControlKind';
import { accountService } from '@/app/services/accountService';
import { toast } from 'sonner';
import type { AccountsHierarchyRowModel } from './useAccountsHierarchyModel';
import type { ControlAccountBreakdownResult } from '@/app/services/controlAccountBreakdownService';

type AccountingLike = {
  accounts: Array<{
    id: string;
    type?: string;
    accountType?: string;
  }>;
  refreshEntries: () => Promise<void>;
};

type Props = {
  row: AccountsHierarchyRowModel;
  accountsViewMode: 'operational' | 'professional';
  accounting: AccountingLike;
  setLedgerAccount: (a: { id: string; name: string; code?: string; type: string }) => void;
  setControlBreakdown: (
    v: {
      account: { id: string; name: string; code?: string };
      kind: ControlAccountBreakdownResult['controlKind'];
    } | null
  ) => void;
  setEditingAccount: (a: unknown) => void;
  setIsEditAccountOpen: (o: boolean) => void;
  setCurrentView: (v: 'contacts' | 'ar-ap-reconciliation-center') => void;
  onOpenAccountStatements: () => void;
};

export function AccountingDashboardAccountRowMenu({
  row,
  accountsViewMode,
  accounting,
  setLedgerAccount,
  setControlBreakdown,
  setEditingAccount,
  setIsEditAccountOpen,
  setCurrentView,
  onOpenAccountStatements,
}: Props) {
  const account = row.account;
  const code = (account as { code?: string }).code;
  const controlKind = getControlAccountKind({ name: account.name, code });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-gray-400 hover:text-white hover:bg-gray-800">
          <MoreVertical size={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-gray-950/95 border-gray-800 text-gray-200 shadow-xl backdrop-blur-sm">
        <DropdownMenuItem
          className="gap-2 focus:bg-gray-800 cursor-pointer"
          onClick={() =>
            toast.message(`${account.name}${code ? ` · ${code}` : ''}`, {
              description: `Balance (GL): ${account.balance ?? 0}`,
            })
          }
        >
          <Eye size={14} className="shrink-0" /> View Details
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2 focus:bg-gray-800 cursor-pointer"
          onClick={() => {
            setEditingAccount(account);
            setIsEditAccountOpen(true);
          }}
        >
          <Edit size={14} className="shrink-0" /> Edit Account
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2 focus:bg-gray-800 cursor-pointer"
          onClick={() => {
            setLedgerAccount({
              id: account.id,
              name: account.name,
              code,
              type: account.type || account.accountType || 'Asset',
            });
          }}
        >
          <FileText size={14} className="shrink-0" /> {controlKind ? 'Open GL ledger' : 'View Ledger'}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2 focus:bg-gray-800 cursor-pointer"
          onClick={() => {
            onOpenAccountStatements();
            toast.info('Account Statements tab — filter or select this account in the report if available.');
          }}
        >
          <BarChart3 size={14} className="shrink-0" /> Statement
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-gray-800" />
        <DropdownMenuItem className="gap-2 focus:bg-gray-800 cursor-pointer" onClick={() => toast.info('Transfer balance — coming soon')}>
          <ArrowLeftRight size={14} className="shrink-0" /> Transfer Balance
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2 focus:bg-gray-800 cursor-pointer"
          onClick={() => toast.info('Add child account — use Create New Account (Professional) and pick parent.')}
        >
          <FolderPlus size={14} className="shrink-0" /> Add Child Account
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2 focus:bg-gray-800 cursor-pointer" onClick={() => toast.info('Duplicate account — coming soon')}>
          <Copy size={14} className="shrink-0" /> Duplicate
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-gray-800" />
        <DropdownMenuItem
          className="gap-2 text-red-400 focus:text-red-300 focus:bg-red-950/40 cursor-pointer"
          onClick={() => toast.error('Account delete is not enabled from this menu.')}
        >
          <Trash2 size={14} className="shrink-0" /> Delete
        </DropdownMenuItem>
        {controlKind && (
          <>
            <DropdownMenuSeparator className="bg-gray-800" />
            <DropdownMenuItem
              className="gap-2 focus:bg-gray-800 cursor-pointer"
              onClick={() =>
                setControlBreakdown({
                  account: { id: account.id!, name: account.name || '', code },
                  kind: controlKind,
                })
              }
            >
              <BarChart3 size={14} className="shrink-0" /> Control breakdown…
            </DropdownMenuItem>
          </>
        )}
        {controlKind && controlKind !== 'suspense' && (
          <>
            <DropdownMenuItem
              className="gap-2 focus:bg-gray-800 cursor-pointer"
              onClick={() => {
                setCurrentView('contacts');
                toast.info(
                  controlKind === 'ar'
                    ? 'Operational: Contacts → Customers tab → party statement (Operational / GL / Reconciliation).'
                    : controlKind === 'ap'
                      ? 'Operational: Contacts → Suppliers tab.'
                      : 'Operational: Contacts → Workers tab.'
                );
              }}
            >
              <Users size={14} className="shrink-0" /> Open operational (Contacts)
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 focus:bg-gray-800 cursor-pointer"
              onClick={() => {
                setCurrentView('contacts');
                toast.info('On Contacts, use reconciliation copy vs GL control for variance context.');
              }}
            >
              <Scale size={14} className="shrink-0" /> Open reconciliation (Contacts)
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 focus:bg-gray-800 cursor-pointer"
              onClick={() => setCurrentView('ar-ap-reconciliation-center')}
            >
              <ShieldAlert size={14} className="shrink-0" /> AR/AP Reconciliation Center
            </DropdownMenuItem>
          </>
        )}
        {controlKind === 'suspense' && (
          <DropdownMenuItem
            className="gap-2 focus:bg-gray-800 cursor-pointer"
            onClick={() => setCurrentView('ar-ap-reconciliation-center')}
          >
            <ShieldAlert size={14} className="shrink-0" /> Reconciliation Center (suspense)
          </DropdownMenuItem>
        )}
        {accountsViewMode === 'professional' && (
          <>
            <DropdownMenuSeparator className="bg-gray-800" />
            <DropdownMenuItem className="gap-2 focus:bg-gray-800 cursor-pointer" onClick={() => toast.info('View Transactions — coming soon')}>
              <List size={14} className="shrink-0" /> View Transactions
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 focus:bg-gray-800 cursor-pointer" onClick={() => toast.info('Account Summary — coming soon')}>
              <BarChart3 size={14} className="shrink-0" /> Account Summary
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator className="bg-gray-800" />
        <DropdownMenuItem
          className="gap-2 focus:bg-gray-800 cursor-pointer"
          onClick={async () => {
            try {
              await accountService.updateAccount(account.id!, {
                is_active: !account.isActive,
              });
              await accounting.refreshEntries();
              toast.success(`Account ${account.isActive ? 'deactivated' : 'activated'}`);
            } catch (error: unknown) {
              const msg = error instanceof Error ? error.message : 'Unknown error';
              toast.error(`Failed to update account: ${msg}`);
            }
          }}
        >
          {account.isActive ? (
            <>
              <XCircle size={14} className="shrink-0" /> Deactivate Account
            </>
          ) : (
            <>
              <CheckCircle2 size={14} className="shrink-0" /> Activate Account
            </>
          )}
        </DropdownMenuItem>
        {(account.type === 'Cash' || account.accountType === 'Cash') && (
          <DropdownMenuItem
            className="gap-2 focus:bg-gray-800 cursor-pointer"
            onClick={async () => {
              try {
                const cashAccounts = accounting.accounts.filter(
                  (a) => (a.type === 'Cash' || a.accountType === 'Cash') && a.id !== account.id
                );
                for (const acc of cashAccounts) {
                  await accountService.updateAccount(acc.id!, { is_default_cash: false });
                }
                await accountService.updateAccount(account.id!, { is_default_cash: true });
                await accounting.refreshEntries();
                toast.success('Set as default Cash account');
              } catch (error: unknown) {
                const msg = error instanceof Error ? error.message : 'Unknown error';
                toast.error(`Failed to set default: ${msg}`);
              }
            }}
          >
            <Star size={14} className="shrink-0" /> Set as Default Cash
          </DropdownMenuItem>
        )}
        {(account.type === 'Bank' || account.accountType === 'Bank') && (
          <DropdownMenuItem
            className="gap-2 focus:bg-gray-800 cursor-pointer"
            onClick={async () => {
              try {
                const bankAccounts = accounting.accounts.filter(
                  (a) => (a.type === 'Bank' || a.accountType === 'Bank') && a.id !== account.id
                );
                for (const acc of bankAccounts) {
                  await accountService.updateAccount(acc.id!, { is_default_bank: false });
                }
                await accountService.updateAccount(account.id!, { is_default_bank: true });
                await accounting.refreshEntries();
                toast.success('Set as default Bank account');
              } catch (error: unknown) {
                const msg = error instanceof Error ? error.message : 'Unknown error';
                toast.error(`Failed to set default: ${msg}`);
              }
            }}
          >
            <Star size={14} className="shrink-0" /> Set as Default Bank
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
