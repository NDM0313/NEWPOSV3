/**
 * Serialize tabular data to CSV (RFC 4180 field quoting when needed).
 */

function escapeCell(value: string): string {
  const s = value == null ? '' : String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** One CSV record from string fields (already logical values). */
export function serializeCsvRow(fields: string[]): string {
  return fields.map(escapeCell).join(',');
}

/** Each row is string[]; uses LF between records (common for downloads). */
export function serializeCsvMatrix(rows: string[][]): string {
  return rows.map((r) => serializeCsvRow(r)).join('\n');
}
