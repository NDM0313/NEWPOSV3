/**
 * Parse phpMyAdmin / MariaDB INSERT blocks from a SQL dump into row objects.
 * Handles escaped quotes, NULL, multi-line value tuples, and HTML in strings.
 */

const INSERT_RE =
  /INSERT\s+INTO\s+`([^`]+)`\s*\(([^)]+)\)\s*VALUES\s*/gi;

function splitColumns(raw) {
  return raw.split(',').map((c) => c.trim().replace(/^`|`$/g, ''));
}

function unescapeSqlString(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '\\' && i + 1 < s.length) {
      const next = s[i + 1];
      if (next === "'" || next === '\\' || next === 'n' || next === 'r' || next === 't') {
        if (next === 'n') out += '\n';
        else if (next === 'r') out += '\r';
        else if (next === 't') out += '\t';
        else out += next;
        i++;
        continue;
      }
    }
    out += ch;
  }
  return out;
}

function parseValueToken(token) {
  const t = token.trim();
  if (t.toUpperCase() === 'NULL') return null;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  if (t.startsWith("'") && t.endsWith("'") && t.length >= 2) {
    return unescapeSqlString(t.slice(1, -1));
  }
  return t;
}

/** Parse comma-separated SQL values inside one (...) tuple. Respects quoted strings. */
function splitTupleValues(inner) {
  const values = [];
  let buf = '';
  let inString = false;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (inString) {
      buf += ch;
      if (ch === '\\' && i + 1 < inner.length) {
        buf += inner[i + 1];
        i++;
        continue;
      }
      if (ch === "'") inString = false;
      continue;
    }
    if (ch === "'") {
      inString = true;
      buf += ch;
      continue;
    }
    if (ch === ',') {
      values.push(parseValueToken(buf));
      buf = '';
      continue;
    }
    buf += ch;
  }
  if (buf.length) values.push(parseValueToken(buf));
  return values;
}

function extractInsertBlocks(sql, tableName) {
  const blocks = [];
  const target = tableName.toLowerCase();
  let m;
  const re = new RegExp(INSERT_RE.source, 'gi');
  while ((m = re.exec(sql)) !== null) {
    if (m[1].toLowerCase() !== target) continue;
    blocks.push({ columns: splitColumns(m[2]), startIndex: m.index + m[0].length });
  }
  return blocks;
}

function parseTuplesFromIndex(sql, startIndex) {
  const rows = [];
  let i = startIndex;
  const len = sql.length;

  while (i < len) {
    while (i < len && (sql[i] === ' ' || sql[i] === '\n' || sql[i] === '\r' || sql[i] === '\t')) i++;
    if (i >= len) break;
    if (sql[i] === ';') break;
    if (sql[i] === ',') {
      i++;
      continue;
    }
    if (sql[i] !== '(') {
      i++;
      continue;
    }
    i++;
    let depth = 1;
    let inner = '';
    let inString = false;
    while (i < len && depth > 0) {
      const ch = sql[i];
      if (inString) {
        inner += ch;
        if (ch === '\\' && i + 1 < len) {
          inner += sql[i + 1];
          i += 2;
          continue;
        }
        if (ch === "'") inString = false;
        i++;
        continue;
      }
      if (ch === "'") {
        inString = true;
        inner += ch;
        i++;
        continue;
      }
      if (ch === '(') {
        depth++;
        if (depth > 1) inner += ch;
        i++;
        continue;
      }
      if (ch === ')') {
        depth--;
        if (depth > 0) inner += ch;
        i++;
        continue;
      }
      inner += ch;
      i++;
    }
    rows.push(splitTupleValues(inner));
  }
  return rows;
}

/**
 * @param {string} sql Full dump text
 * @param {string} tableName e.g. accounting_accounts
 * @returns {Record<string, unknown>[]}
 */
export function parseSqlInsertRows(sql, tableName) {
  const blocks = extractInsertBlocks(sql, tableName);
  const all = [];
  for (const block of blocks) {
    const tuples = parseTuplesFromIndex(sql, block.startIndex);
    for (const tuple of tuples) {
      const row = {};
      block.columns.forEach((col, idx) => {
        row[col] = tuple[idx] ?? null;
      });
      all.push(row);
    }
  }
  return all;
}
