import { localNowDateString } from '../utils/localDate';

/** Calendar YYYY-MM-DD → timestamptz at noon UTC (stable day for backdated Send/Receive). */
export function parseStudioWorkflowDate(dateStr?: string | null): string | undefined {
  if (!dateStr?.trim()) return undefined;
  const d = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return `${d}T12:00:00.000Z`;
  return d;
}

export function todayDateInputValue(): string {
  return localNowDateString();
}
