import * as React from 'react';
import { Badge } from './badge';
import { cn } from './utils';

export function ErpSurfaceCard({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="erp-surface-card"
      className={cn('bg-card border border-border rounded-xl', className)}
      {...props}
    />
  );
}

/* ── Page layout ─────────────────────────────────────────────── */

export function ErpPage({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="erp-page"
      className={cn('flex flex-col h-full min-h-0 bg-secondary text-foreground', className)}
      {...props}
    />
  );
}

export function ErpPageHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="erp-page-header"
      className={cn('shrink-0 px-6 py-4 border-b border-border flex justify-between items-start', className)}
      {...props}
    />
  );
}

export function ErpPageTitle({ className, ...props }: React.ComponentProps<'h1'>) {
  return <h1 className={cn('text-2xl font-semibold text-foreground', className)} {...props} />;
}

export function ErpPageDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('text-sm text-muted-foreground mt-0.5', className)} {...props} />;
}

/* ── Filter panel + segmented tabs ───────────────────────────── */

export function ErpFilterPanel({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="erp-filter-panel"
      className={cn('rounded-lg border border-border bg-card p-4 space-y-4', className)}
      {...props}
    />
  );
}

export function ErpSegmentedTab({
  active = false,
  className,
  ...props
}: React.ComponentProps<'button'> & { active?: boolean }) {
  return (
    <button
      type="button"
      data-slot="erp-segmented-tab"
      className={cn(
        'px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2',
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function ErpSegmentedTabSm({
  active = false,
  className,
  ...props
}: React.ComponentProps<'button'> & { active?: boolean }) {
  return (
    <button
      type="button"
      data-slot="erp-segmented-tab-sm"
      className={cn(
        'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground',
        className,
      )}
      {...props}
    />
  );
}

const ERP_INFO_PANEL_VARIANTS = {
  info: 'border-primary/25 bg-primary/5 text-foreground',
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-100',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100',
  cyan: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-800 dark:text-cyan-100',
} as const;

export function ErpInfoPanel({
  variant = 'info',
  className,
  ...props
}: React.ComponentProps<'div'> & { variant?: keyof typeof ERP_INFO_PANEL_VARIANTS }) {
  return (
    <div
      data-slot="erp-info-panel"
      className={cn('rounded-xl border', ERP_INFO_PANEL_VARIANTS[variant], className)}
      {...props}
    />
  );
}

/* ── Table shell ─────────────────────────────────────────────── */

export function ErpTableShell({ className, children, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="erp-table-shell"
      className={cn(
        'flex-1 min-h-0 bg-card border border-border rounded-xl overflow-hidden flex flex-col',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function ErpTableScroll({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex-1 min-h-0 overflow-auto', className)} {...props} />;
}

export function ErpTable({ className, ...props }: React.ComponentProps<'table'>) {
  return <table className={cn('w-full min-w-[1000px]', className)} {...props} />;
}

export function ErpTableHead({ className, ...props }: React.ComponentProps<'thead'>) {
  return <thead className={cn('bg-muted/40 border-b border-border', className)} {...props} />;
}

export function ErpTableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return <tbody className={cn('divide-y divide-border', className)} {...props} />;
}

export function ErpTableRow({
  className,
  child = false,
  ...props
}: React.ComponentProps<'tr'> & { child?: boolean }) {
  return (
    <tr
      className={cn(
        child
          ? 'border-l-2 border-border hover:bg-[var(--erp-row-hover)] transition-colors'
          : 'hover:bg-[var(--erp-row-hover)] transition-colors',
        className,
      )}
      {...props}
    />
  );
}

export function ErpTableCell({
  className,
  align = 'left',
  ...props
}: React.ComponentProps<'td'> & { align?: 'left' | 'center' | 'right' }) {
  return (
    <td
      className={cn(
        'px-4 py-2.5 text-sm',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        align === 'left' && 'text-left',
        className,
      )}
      {...props}
    />
  );
}

export function ErpTableHeaderCell({
  className,
  align = 'left',
  ...props
}: React.ComponentProps<'th'> & { align?: 'left' | 'center' | 'right' }) {
  return (
    <th
      className={cn(
        'px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        align === 'left' && 'text-left',
        className,
      )}
      {...props}
    />
  );
}

/* ── Column alignment helper ─────────────────────────────────── */

const RIGHT_COLS = new Set(['avgCost', 'sellingPrice', 'stockValue']);
const CENTER_COLS = new Set(['stockQty', 'unit', 'boxes', 'pieces', 'movement', 'status', 'actions']);

export function erpColumnAlign(key: string): 'left' | 'center' | 'right' {
  if (RIGHT_COLS.has(key)) return 'right';
  if (CENTER_COLS.has(key)) return 'center';
  return 'left';
}

/* ── Money / numeric cells ───────────────────────────────────── */

export function ErpMoneyCell({
  value,
  className,
  format,
}: {
  value: number;
  className?: string;
  format?: (n: number) => string;
}) {
  const formatted = format
    ? format(value)
    : Number(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return (
    <span
      className={cn(
        'text-right text-sm font-medium tabular-nums',
        value < 0 ? 'text-[var(--erp-money-negative)]' : 'text-foreground',
        className,
      )}
    >
      {formatted}
    </span>
  );
}

export function ErpPositiveMoney({
  value,
  className,
  format,
  as: Tag = 'span',
}: {
  value: number | string;
  className?: string;
  format?: (n: number) => string;
  as?: 'span' | 'p' | 'div';
}) {
  const display =
    typeof value === 'number'
      ? format
        ? format(value)
        : value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
      : value;
  return (
    <Tag className={cn('tabular-nums font-semibold text-[var(--erp-money-positive)]', className)}>
      {display}
    </Tag>
  );
}

export function ErpNegativeMoney({
  value,
  className,
  format,
  as: Tag = 'span',
}: {
  value: number | string;
  className?: string;
  format?: (n: number) => string;
  as?: 'span' | 'p' | 'div';
}) {
  const display =
    typeof value === 'number'
      ? format
        ? format(value)
        : value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
      : value;
  return (
    <Tag className={cn('tabular-nums font-semibold text-[var(--erp-money-negative)]', className)}>
      {display}
    </Tag>
  );
}

/* ── Drawer shell ────────────────────────────────────────────── */

export function ErpDrawerPanel({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="erp-drawer-panel"
      className={cn(
        'w-full max-w-2xl h-screen bg-background border-l border-border shadow-2xl flex flex-col',
        className,
      )}
      {...props}
    />
  );
}

/* ── Status badges ───────────────────────────────────────────── */

export function ErpMovementBadge({ movement }: { movement: string }) {
  const styles: Record<string, string> = {
    Fast: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    Medium: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    Slow: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    Dead: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  return (
    <Badge className={cn('border text-xs', styles[movement] ?? 'bg-muted text-muted-foreground border-border')}>
      {movement}
    </Badge>
  );
}

export function ErpStatusBadge({ status }: { status: string }) {
  if (status === 'Out') {
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">Out</Badge>;
  }
  if (status === 'Low') {
    return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs">Low</Badge>;
  }
  return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">OK</Badge>;
}

export function ErpCategoryBadge({ label }: { label: string }) {
  return (
    <Badge variant="outline" className="text-xs text-muted-foreground border-border bg-muted/30">
      {label}
    </Badge>
  );
}

/* ── CSS Grid data tables (Sales, Purchases lists) ───────────── */

export function ErpDataGridShell({
  className,
  children,
  minWidth = '1400px',
  ...props
}: React.ComponentProps<'div'> & { minWidth?: string }) {
  return (
    <ErpTableShell className={cn('overflow-hidden', className)} {...props}>
      <div className="overflow-x-auto">
        <div style={{ minWidth }}>{children}</div>
      </div>
    </ErpTableShell>
  );
}

export function ErpDataGridHeader({
  className,
  minWidth,
  style,
  ...props
}: React.ComponentProps<'div'> & { minWidth?: string }) {
  return (
    <div
      data-slot="erp-data-grid-header"
      className={cn(
        'sticky top-0 z-10 w-max bg-muted/40 border-b border-border',
        minWidth && `min-w-[${minWidth}]`,
        className,
      )}
      style={{ minWidth, ...style }}
      {...props}
    />
  );
}

export function ErpDataGridHeaderRow({
  className,
  style,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'grid gap-3 px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider',
        className,
      )}
      style={style}
      {...props}
    />
  );
}

export function ErpDataGridBody({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="erp-data-grid-body" className={cn('w-max', className)} {...props} />;
}

export function ErpDataGridRow({
  className,
  style,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="erp-data-grid-row"
      className={cn(
        'grid gap-3 px-4 min-w-full w-max items-center border-b border-border last:border-b-0',
        'hover:bg-[var(--erp-row-hover)] transition-colors',
        className,
      )}
      style={{
        minHeight: 'var(--erp-row-padding, 4rem)',
        ...style,
      }}
      {...props}
    />
  );
}

export function ErpDataGridCell({
  className,
  align = 'left',
  ...props
}: React.ComponentProps<'div'> & { align?: 'left' | 'center' | 'right' }) {
  return (
    <div
      data-slot="erp-data-grid-cell"
      className={cn(
        'min-h-[2.5rem] flex items-center px-1 -mx-1',
        align === 'right' && 'justify-end text-right',
        align === 'center' && 'justify-center text-center',
        align === 'left' && 'justify-start text-left',
        className,
      )}
      {...props}
    />
  );
}
