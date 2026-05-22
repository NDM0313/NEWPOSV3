const SEND_PREFIX = '[Send]: ';
const RECEIVE_PREFIX = '[Receive]: ';
const PAYMENT_PREFIX = '[Payment Remarks]: ';

const WORKFLOW_PREFIXES = [SEND_PREFIX, RECEIVE_PREFIX, PAYMENT_PREFIX, '[Task]: '];

export function formatSendNotes(text: string): string {
  return text.trim();
}

export function formatReceiveNotes(text: string): string {
  return text.trim();
}

function parsePrefixedLine(notes: string | null | undefined, prefix: string): string | null {
  if (!notes?.trim()) return null;
  for (const line of notes.split(/\r?\n/)) {
    const t = line.trim();
    if (t.startsWith(prefix)) {
      const body = t.slice(prefix.length).trim();
      return body || null;
    }
  }
  return null;
}

export function parseSendNotes(notes: string | null | undefined): string | null {
  return parsePrefixedLine(notes, SEND_PREFIX);
}

export function parseReceiveNotes(notes: string | null | undefined): string | null {
  return parsePrefixedLine(notes, RECEIVE_PREFIX);
}

export function parsePaymentRemarks(notes: string | null | undefined): string | null {
  return parsePrefixedLine(notes, PAYMENT_PREFIX);
}

export function displayNotesWithoutWorkflowPrefixes(notes: string | null | undefined): string {
  if (!notes?.trim()) return '';
  const rest = notes
    .split(/\r?\n/)
    .filter((l) => !WORKFLOW_PREFIXES.some((p) => l.trim().startsWith(p)));
  return rest.join('\n').trim();
}

export function formatIsoDateShort(iso: string | null | undefined): string {
  if (!iso?.trim()) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
    return d.toISOString().slice(0, 10);
  } catch {
    return iso.slice(0, 10);
  }
}
