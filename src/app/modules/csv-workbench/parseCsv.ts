/**
 * RFC 4180–style CSV parsing (client-side).
 * - Double-quoted fields; quotes inside fields escaped as ""
 * - Supports \n and \r\n record separators
 * - Strips UTF-8 BOM if present
 */

import type { ParsedCsv } from './types';

function stripBom(input: string): string {
  return input.replace(/^\uFEFF/, '');
}

/**
 * Parse full CSV text into a matrix of strings (no type coercion).
 */
export function parseCsvToMatrix(input: string): string[][] {
  const s = stripBom(input);
  if (!s.trim()) return [];

  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQuotes = false;

  const addField = () => {
    row.push(cur);
    cur = '';
  };

  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < s.length && s[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      addField();
    } else if (ch === '\r') {
      continue;
    } else if (ch === '\n') {
      addField();
      rows.push(row);
      row = [];
    } else {
      cur += ch;
    }
  }

  addField();
  rows.push(row);

  while (rows.length > 0) {
    const last = rows[rows.length - 1]!;
    if (last.length === 1 && last[0] === '') {
      rows.pop();
    } else if (last.every((c) => c === '')) {
      rows.pop();
    } else {
      break;
    }
  }

  return rows;
}

/**
 * First row = headers; remaining rows padded/truncated to header width.
 */
export function parseCsvToStructured(input: string): ParsedCsv | { error: string } {
  const matrix = parseCsvToMatrix(input);
  if (matrix.length === 0) return { error: 'CSV is empty' };
  const rawHeaders = matrix[0]!.map((h) => h.trim());
  if (rawHeaders.length === 0 || rawHeaders.every((h) => h === '')) {
    return { error: 'CSV has no header row' };
  }

  const width = rawHeaders.length;
  const dataRows: string[][] = [];
  for (let r = 1; r < matrix.length; r++) {
    const line = matrix[r]!;
    const padded: string[] = [];
    for (let c = 0; c < width; c++) {
      padded.push((line[c] ?? '').trim());
    }
    dataRows.push(padded);
  }

  return { headers: rawHeaders, rows: dataRows };
}
