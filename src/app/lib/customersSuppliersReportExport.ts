import type { CustomersSuppliersColumnKey, CustomersSuppliersReportRow } from '@/app/services/customersSuppliersReportService';
import {
  CUSTOMERS_SUPPLIERS_COLUMN_LABELS,
  rowsToExportData,
} from '@/app/services/customersSuppliersReportService';
import type { CustomersSuppliersTotals } from '@/app/lib/customersSuppliersReportLogic';
import { exportToCSV } from '@/app/utils/exportUtils';

export type CustomersSuppliersExportMeta = {
  title: string;
  periodLabel: string;
  filenameBase: string;
};

function totalsRow(
  visibleKeys: CustomersSuppliersColumnKey[],
  totals: CustomersSuppliersTotals,
  formatCurrency: (n: number) => string,
  rawNumbers: boolean
): (string | number)[] {
  return visibleKeys.map((k) => {
    if (k === 'contact') return 'Total:';
    const val = totals[k as keyof CustomersSuppliersTotals];
    return rawNumbers ? val : formatCurrency(val);
  });
}

export function exportCustomersSuppliersCsv(
  rows: CustomersSuppliersReportRow[],
  visibleKeys: CustomersSuppliersColumnKey[],
  totals: CustomersSuppliersTotals,
  formatCurrency: (n: number) => string,
  meta: CustomersSuppliersExportMeta
): void {
  const data = rowsToExportData(rows, visibleKeys, formatCurrency, true);
  data.rows.push(totalsRow(visibleKeys, totals, formatCurrency, true));
  exportToCSV(data, meta.filenameBase);
}

export async function exportCustomersSuppliersExcel(
  rows: CustomersSuppliersReportRow[],
  visibleKeys: CustomersSuppliersColumnKey[],
  totals: CustomersSuppliersTotals,
  formatCurrency: (n: number) => string,
  meta: CustomersSuppliersExportMeta
): Promise<void> {
  const XLSX = await import('xlsx');
  const headers = visibleKeys.map((k) => CUSTOMERS_SUPPLIERS_COLUMN_LABELS[k]);
  const body = rows.map((r) =>
    visibleKeys.map((k) => {
      if (k === 'contact') return r.contactName;
      return r[k as keyof CustomersSuppliersReportRow] as number;
    })
  );
  body.push(
    visibleKeys.map((k) => {
      if (k === 'contact') return 'Total:';
      return totals[k as keyof CustomersSuppliersTotals];
    })
  );
  const sheet = XLSX.utils.aoa_to_sheet([[meta.title], [meta.periodLabel], [], headers, ...body]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Customers & Suppliers');
  XLSX.writeFile(wb, `${meta.filenameBase}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function exportCustomersSuppliersPdf(
  rows: CustomersSuppliersReportRow[],
  visibleKeys: CustomersSuppliersColumnKey[],
  totals: CustomersSuppliersTotals,
  formatCurrency: (n: number) => string,
  meta: CustomersSuppliersExportMeta
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  pdf.setFontSize(14);
  pdf.text(meta.title, 14, 14);
  pdf.setFontSize(9);
  pdf.text(meta.periodLabel, 14, 20);

  const head = [visibleKeys.map((k) => CUSTOMERS_SUPPLIERS_COLUMN_LABELS[k])];
  const body = rows.map((r) =>
    visibleKeys.map((k) => {
      if (k === 'contact') return r.contactName;
      return formatCurrency(r[k as keyof CustomersSuppliersReportRow] as number);
    })
  );
  body.push(
    visibleKeys.map((k) => {
      if (k === 'contact') return 'Total:';
      return formatCurrency(totals[k as keyof CustomersSuppliersTotals]);
    })
  );

  autoTable(pdf, {
    head,
    body,
    startY: 24,
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    footStyles: { fillColor: [241, 245, 249], textColor: 0, fontStyle: 'bold' },
    theme: 'grid',
    margin: { left: 10, right: 10 },
  });

  pdf.save(`${meta.filenameBase}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function printCustomersSuppliersReport(): void {
  window.print();
}
