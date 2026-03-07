/**
 * Studio deadline stored in sale.notes as "StudioDeadline:YYYY-MM-DD" so pipeline and view can show it.
 */

const PREFIX = 'StudioDeadline:';
const REGEX = /StudioDeadline:\d{4}-\d{2}-\d{2}\s*\n?/gi;

/** Parse deadline from notes; returns ISO date string or null and notes without the tag. */
export function parseStudioDeadlineFromNotes(notes: string | undefined | null): { deadline: string | null; notesWithoutDeadline: string } {
  const raw = (notes ?? '').trim();
  const match = raw.match(new RegExp(`^${PREFIX}(\\d{4}-\\d{2}-\\d{2})`, 'i'));
  if (match) {
    const deadline = match[1];
    const rest = raw.replace(REGEX, '').trim();
    return { deadline, notesWithoutDeadline: rest };
  }
  const inline = raw.match(new RegExp(`${PREFIX}(\\d{4}-\\d{2}-\\d{2})`, 'i'));
  if (inline) {
    const deadline = inline[1];
    const notesWithoutDeadline = raw.replace(REGEX, '').trim();
    return { deadline, notesWithoutDeadline };
  }
  return { deadline: null, notesWithoutDeadline: raw };
}

/** Get only the deadline string from notes (for display). */
export function getStudioDeadlineFromNotes(notes: string | undefined | null): string | null {
  return parseStudioDeadlineFromNotes(notes).deadline;
}

/** Build notes string including studio deadline when provided. */
export function buildNotesWithStudioDeadline(studioDeadline: Date | undefined, userNotes: string): string {
  const dateStr = studioDeadline
    ? `${studioDeadline.getFullYear()}-${String(studioDeadline.getMonth() + 1).padStart(2, '0')}-${String(studioDeadline.getDate()).padStart(2, '0')}`
    : '';
  const prefix = dateStr ? `${PREFIX}${dateStr}\n` : '';
  return prefix + (userNotes || '').trim();
}
