/** Roznamcha / Day Book details cell — avoid repeating text already in `details`. */

function normalizePart(value: string): string {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

type RoznamchaDescriptionFields = {
  details: string;
  referenceDisplay?: string;
  partyLine?: string | null;
  createdBy?: string | null;
};

function collectMetaParts(r: RoznamchaDescriptionFields): string[] {
  const normPrimary = normalizePart((r.details || '').trim() || '—');
  const seen = new Set<string>();
  const metaParts: string[] = [];

  for (const raw of [r.referenceDisplay, r.partyLine, r.createdBy ? `by ${r.createdBy}` : '']) {
    const text = String(raw || '').trim();
    if (!text) continue;
    const norm = normalizePart(text);
    if (!norm || norm === normPrimary || normPrimary.includes(norm) || seen.has(norm)) continue;
    seen.add(norm);
    metaParts.push(text);
  }

  return metaParts;
}

/** Subline only (ref / party / by) — skips text already present in `details`. */
export function roznamchaMetaSubline(r: RoznamchaDescriptionFields): string {
  return collectMetaParts(r).join(' · ');
}

export function formatRoznamchaRowDescription(r: RoznamchaDescriptionFields): string {
  const primary = (r.details || '').trim() || '—';
  const meta = roznamchaMetaSubline(r);
  return meta ? `${primary}\n${meta}` : primary;
}
