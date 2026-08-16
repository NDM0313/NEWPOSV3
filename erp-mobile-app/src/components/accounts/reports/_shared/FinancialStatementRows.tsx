import type { ReactNode } from 'react';
import { ReportCard, ReportSectionTitle } from './ReportShell';
import { formatAmount } from './format';

export type FinancialLineItem = {
  name: string;
  amount: number;
  code?: string;
};

export type FinancialSubgroup = {
  groupLabel: string;
  items: FinancialLineItem[];
  subtotal: number;
};

export function FinancialLineRow({
  item,
  canViewBalances,
  amountDigits = 2,
  amountColor,
}: {
  item: FinancialLineItem;
  canViewBalances: boolean;
  amountDigits?: number;
  amountColor?: string;
}) {
  const color =
    amountColor ??
    (item.amount > 0 ? 'text-[#10B981]' : item.amount < 0 ? 'text-[#EF4444]' : 'text-[#9CA3AF]');

  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">
            {item.code ? (
              <span className="font-mono text-[11px] text-[#9CA3AF] mr-2">{item.code}</span>
            ) : null}
            {item.name}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-sm font-bold ${canViewBalances ? color : 'text-[#9CA3AF]'}`}>
            {canViewBalances ? `Rs. ${formatAmount(item.amount, amountDigits)}` : '****'}
          </p>
        </div>
      </div>
    </li>
  );
}

export function FinancialSectionCard({
  title,
  items,
  subgroups,
  total,
  canViewBalances,
  amountDigits = 2,
  maxItems = 80,
}: {
  title: string;
  items?: FinancialLineItem[];
  subgroups?: FinancialSubgroup[];
  total: number;
  canViewBalances: boolean;
  amountDigits?: number;
  maxItems?: number;
}) {
  const flatItems = items ?? subgroups?.flatMap((g) => g.items) ?? [];
  const itemCount = flatItems.length;
  const rightTotal = canViewBalances ? `Rs. ${formatAmount(total, amountDigits)}` : '****';

  const renderItems = (list: FinancialLineItem[], keyPrefix: string) =>
    list.slice(0, maxItems).map((item, i) => (
      <FinancialLineRow
        key={`${keyPrefix}-${item.code || item.name}-${i}`}
        item={item}
        canViewBalances={canViewBalances}
        amountDigits={amountDigits}
      />
    ));

  return (
    <div>
      <ReportSectionTitle
        title={title}
        subtitle={itemCount > 0 ? `${itemCount} account${itemCount === 1 ? '' : 's'}` : undefined}
        right={rightTotal}
      />
      <ReportCard className="overflow-hidden">
        <ul className="divide-y divide-[#374151]">
          {subgroups
            ? subgroups.map((group) => (
                <li key={group.groupLabel}>
                  <div className="px-4 py-2 bg-[#111827]/50 border-b border-[#374151]">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF] truncate">
                        {group.groupLabel}
                      </p>
                      <p className="text-[10px] font-mono text-[#6B7280] shrink-0">
                        {canViewBalances ? `Rs. ${formatAmount(group.subtotal, amountDigits)}` : '****'}
                      </p>
                    </div>
                  </div>
                  <ul className="divide-y divide-[#374151]">{renderItems(group.items, group.groupLabel)}</ul>
                </li>
              ))
            : renderItems(items ?? [], title)}
        </ul>
        {itemCount > maxItems && (
          <p className="px-4 py-2 text-xs text-[#6B7280]">+{itemCount - maxItems} more lines</p>
        )}
        {canViewBalances && (
          <div className="border-t border-[#374151] px-4 py-3 bg-[#111827]/40">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
                Total {title}
              </p>
              <p className="text-sm font-mono font-semibold text-white">
                Rs. {formatAmount(total, amountDigits)}
              </p>
            </div>
          </div>
        )}
      </ReportCard>
    </div>
  );
}

export type FinancialTotalsFooterCell = {
  label: string;
  value: string;
  color?: string;
};

export function FinancialTotalsFooter({
  title = 'Summary',
  cells,
  children,
}: {
  title?: string;
  cells: FinancialTotalsFooterCell[];
  children?: ReactNode;
}) {
  if (cells.length === 0 && !children) return null;

  return (
    <ReportCard className="overflow-hidden">
      <div className="border-t border-[#374151] px-4 py-3 bg-[#111827]/40">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF] mb-2">{title}</p>
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${Math.min(cells.length, 3)}, minmax(0, 1fr))` }}
        >
          {cells.map((cell) => (
            <div key={cell.label}>
              <p className="text-[10px] text-[#6B7280]">{cell.label}</p>
              <p className={`text-xs font-mono font-semibold ${cell.color ?? 'text-white'}`}>{cell.value}</p>
            </div>
          ))}
        </div>
        {children}
      </div>
    </ReportCard>
  );
}
