/** Prefix for custom/extra stage display name in studio_production_stages.notes */
const TASK_PREFIX = '[Task]: ';

/** Format notes for a custom task (stage_type = extra). */
export function formatExtraStageNotes(displayName: string): string {
  const name = displayName.trim();
  if (!name) return `${TASK_PREFIX}Custom task`;
  return `${TASK_PREFIX}${name}`;
}

/** Extract display name from notes for extra stages; null if not an extra task label. */
export function parseExtraStageDisplayName(
  notes: string | null | undefined,
  stageType: string
): string | null {
  if ((stageType || '').toLowerCase() !== 'extra') return null;
  if (!notes?.trim()) return null;
  const lines = notes.split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith(TASK_PREFIX)) {
      const name = t.slice(TASK_PREFIX.length).trim();
      return name || null;
    }
  }
  return null;
}

/** User/worker notes without the [Task]: title line (for display in notes field). */
export function extraStageUserNotes(notes: string | null | undefined): string {
  if (!notes?.trim()) return '';
  const lines = notes.split(/\r?\n/);
  const rest = lines.filter((l) => !l.trim().startsWith(TASK_PREFIX));
  return rest.join('\n').trim();
}

/** Merge task title with optional user notes for DB storage. */
export function mergeExtraStageNotes(displayName: string, userNotes?: string | null): string {
  const title = formatExtraStageNotes(displayName);
  const extra = (userNotes ?? '').trim();
  if (!extra) return title;
  return `${title}\n${extra}`;
}

/** When updating notes on an extra stage, keep [Task]: line if present. */
export function preserveExtraNotesOnUpdate(
  existingNotes: string | null | undefined,
  newUserNotes: string | null | undefined,
  stageType: string
): string | null {
  if ((stageType || '').toLowerCase() !== 'extra') {
    return newUserNotes?.trim() || null;
  }
  const title = parseExtraStageDisplayName(existingNotes, 'extra');
  if (!title) {
    return newUserNotes?.trim() || null;
  }
  return mergeExtraStageNotes(title, newUserNotes);
}
