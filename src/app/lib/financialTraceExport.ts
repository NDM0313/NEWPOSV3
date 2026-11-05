/**
 * Financial Trace Center — read-only export helpers (CSV / copy text).
 */

export function rowsToCsv(rows: Record<string, unknown>[], columns?: string[]): string {
  if (rows.length === 0) return '';
  const cols = columns ?? Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const header = cols.join(',');
  const body = rows.map((r) => cols.map((c) => escape(r[c])).join(',')).join('\n');
  return `${header}\n${body}`;
}

export function downloadTextFile(filename: string, content: string, mime = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[], columns?: string[]): void {
  downloadTextFile(filename, rowsToCsv(rows, columns), 'text/csv;charset=utf-8');
}

export async function copyTraceSummary(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function buildOverviewSummaryText(input: {
  asOfDate: string;
  glArNet: number | null;
  glApNet: number | null;
  control1100: number | null;
  arCusSum: number | null;
  opsSalesDue: number | null;
  unposted: number;
  unmappedAr: number;
  manual: number;
}): string {
  return [
    `Financial Trace Center — Overview (${input.asOfDate})`,
    `GL AR net: ${input.glArNet ?? '—'}`,
    `GL AP net: ${input.glApNet ?? '—'}`,
    `1100 control net: ${input.control1100 ?? '—'}`,
    `AR-CUS sub-ledger sum: ${input.arCusSum ?? '—'}`,
    `Operational sales due: ${input.opsSalesDue ?? '—'}`,
    `Unposted docs: ${input.unposted}`,
    `Unmapped AR JEs: ${input.unmappedAr}`,
    `Manual/suspense rows: ${input.manual}`,
    '',
    'Read-only diagnosis — no repairs applied.',
  ].join('\n');
}
