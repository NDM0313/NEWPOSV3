/** Prefix for custom/extra stage display name in studio_production_stages.notes */
const TASK_PREFIX = '[Task]: ';

export function formatExtraStageNotes(displayName: string): string {
  const name = displayName.trim();
  if (!name) return `${TASK_PREFIX}Custom task`;
  return `${TASK_PREFIX}${name}`;
}

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

export function extraStageUserNotes(notes: string | null | undefined): string {
  if (!notes?.trim()) return '';
  const lines = notes.split(/\r?\n/);
  const rest = lines.filter((l) => !l.trim().startsWith(TASK_PREFIX));
  return rest.join('\n').trim();
}

export function mergeExtraStageNotes(displayName: string, userNotes?: string | null): string {
  const title = formatExtraStageNotes(displayName);
  const extra = (userNotes ?? '').trim();
  if (!extra) return title;
  return `${title}\n${extra}`;
}
