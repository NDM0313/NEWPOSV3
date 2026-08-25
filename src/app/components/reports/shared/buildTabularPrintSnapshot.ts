import type { TabularReportColumn } from './TabularReportPreview';

export type TabularColumnDef = {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
};

export interface BuildTabularPrintSnapshotOptions<T> {
  allColumns: TabularColumnDef[];
  visibleColumns: Record<string, boolean>;
  rows: T[];
  cellValue: (row: T, key: string, forExport?: boolean) => string | number;
  /** Optional per-cell formatter after cellValue (e.g. currency for display export). */
  formatCell?: (key: string, value: string | number, forExport: boolean) => string | number;
}

export interface TabularPrintSnapshot {
  columns: TabularReportColumn[];
  rows: (string | number)[][];
}

/**
 * Build print/PDF/CSV/Excel table from current UI column visibility.
 * Columns hidden in the data table (`visibleColumns[key] === false`) are excluded.
 */
export function buildTabularPrintSnapshot<T>({
  allColumns,
  visibleColumns,
  rows,
  cellValue,
  formatCell,
}: BuildTabularPrintSnapshotOptions<T>): TabularPrintSnapshot {
  const columns: TabularReportColumn[] = allColumns
    .filter((c) => visibleColumns[c.key] !== false)
    .map((c) => ({ key: c.key, label: c.label, align: c.align }));

  const snapshotRows = rows.map((row) =>
    columns.map((col) => {
      const raw = cellValue(row, col.key, true);
      return formatCell ? formatCell(col.key, raw, true) : raw;
    }),
  );

  return { columns, rows: snapshotRows };
}
