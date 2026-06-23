import { SearchableSelect } from '@/app/components/ui/searchable-select';
import type {
  LedgerEntityOption,
  LedgerStatementV2Type,
  LedgerTransactionTypeFilter,
} from './types';

export interface LedgerFilterBarProps {
  statementType: LedgerStatementV2Type;
  onStatementTypeChange: (t: LedgerStatementV2Type) => void;
  entities: LedgerEntityOption[];
  entityId: string;
  onEntityChange: (id: string) => void;
  entitiesLoading: boolean;
  dateRangeLabel: string;
  /** Where the statement period comes from — tab pickers vs global header. */
  periodSource?: 'header' | 'tab';
  transactionType: LedgerTransactionTypeFilter;
  onTransactionTypeChange: (t: LedgerTransactionTypeFilter) => void;
  search: string;
  onSearchChange: (s: string) => void;
  loading: boolean;
}

const TYPE_OPTIONS: { value: LedgerStatementV2Type; label: string }[] = [
  { value: 'customer', label: 'Customer' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'worker', label: 'Worker' },
  { value: 'account', label: 'Account / Chart of Accounts' },
];

const TX_OPTIONS: { value: LedgerTransactionTypeFilter; label: string }[] = [
  { value: 'all', label: 'All types' },
  { value: 'sale', label: 'Sales' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'payment_received', label: 'Payment received' },
  { value: 'payment_paid', label: 'Payment paid' },
  { value: 'return', label: 'Return' },
  { value: 'rental', label: 'Rental' },
  { value: 'expense', label: 'Expense' },
  { value: 'journal', label: 'Journal entry' },
  { value: 'opening', label: 'Opening balance' },
];

export function LedgerFilterBar(props: LedgerFilterBarProps) {
  const entityOptions = props.entities.map((e) => ({
    id: e.id,
    name: e.phone ? `${e.label} · ${e.phone}` : e.label,
  }));

  return (
    <div className="rounded-xl border border-gray-800 bg-[#0F1419] p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <span className="uppercase tracking-wide">Period</span>
        <span className="text-gray-300 font-medium">{props.dateRangeLabel}</span>
        <span className="text-gray-600">
          ·{' '}
          {props.periodSource === 'tab'
            ? 'period from Account Statements dates above (all branches)'
            : 'use the date filter in the top header'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide mb-1.5 block">Statement type</label>
          <select
            value={props.statementType}
            onChange={(e) => props.onStatementTypeChange(e.target.value as LedgerStatementV2Type)}
            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="text-xs text-gray-500 uppercase tracking-wide mb-1.5 block">Party / account</label>
          <SearchableSelect
            value={props.entityId}
            onValueChange={props.onEntityChange}
            options={entityOptions}
            placeholder={props.entitiesLoading ? 'Loading…' : 'Search and select…'}
            filterFn={(opt, search) => {
              const ent = props.entities.find((x) => x.id === opt.id);
              const blob = `${opt.name} ${ent?.sublabel || ''} ${ent?.code || ''}`.toLowerCase();
              return blob.includes(search.toLowerCase());
            }}
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide mb-1.5 block">Branch</label>
          <select
            value="all"
            disabled
            title="Matches Accounting → Account Statements (all branches; see Branch column per row)"
            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-500 cursor-not-allowed opacity-80"
          >
            <option value="all">All branches (GL scope)</option>
          </select>
          <p className="text-[10px] text-gray-600 mt-1 leading-snug">
            Matches Accounting → Account Statements. Branch shown on each row.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide mb-1.5 block">Transaction type</label>
          <select
            value={props.transactionType}
            onChange={(e) => props.onTransactionTypeChange(e.target.value as LedgerTransactionTypeFilter)}
            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
          >
            {TX_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide mb-1.5 block">Search</label>
          <input
            type="search"
            value={props.search}
            onChange={(e) => props.onSearchChange(e.target.value)}
            placeholder="Ref, amount, notes…"
            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600"
          />
        </div>
      </div>

      {props.loading ? (
        <p className="text-xs text-gray-500 text-right">Loading statement…</p>
      ) : null}
    </div>
  );
}

