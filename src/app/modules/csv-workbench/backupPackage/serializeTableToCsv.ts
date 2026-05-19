/**
 * Generic row[] → CSV using workbench serializer.
 */

import { serializeCsvMatrix } from '../serializeCsv';

function cellValue(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/** Rows as objects; column order from keys or explicit headers. */
export function serializeTableToCsv(
  rows: Record<string, unknown>[],
  headers?: string[]
): string {
  if (!rows.length) {
    const h = headers ?? [];
    return h.length ? serializeCsvMatrix([h]) : '';
  }
  const cols =
    headers ??
    [
      ...new Set(
        rows.flatMap((r) => Object.keys(r).filter((k) => r[k] !== undefined))
      ),
    ];
  const matrix = [
    cols,
    ...rows.map((r) => cols.map((c) => cellValue(r[c]))),
  ];
  return serializeCsvMatrix(matrix);
}
