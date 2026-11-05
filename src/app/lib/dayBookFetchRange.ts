/**
 * Day Book query window — honors Global Filter / local picker as-is.
 * Dashboard V2 still uses clampWideDateRange; Day Book must not rewrite From start.
 */

export const DAY_BOOK_JE_CHUNK = 500;

/** Soft safety ceiling (20k vouchers). Truncation warning only if this fills. */
export const DAY_BOOK_MAX_JE_PAGES = 40;

export type DayBookFetchRange = {
  dateFrom: string;
  dateTo: string;
};

/** Resolve Day Book fetch dates from the selected range (no year clamp). */
export function resolveDayBookFetchRange(
  rawDateFrom: string,
  rawDateTo: string,
): DayBookFetchRange {
  return {
    dateFrom: rawDateFrom.slice(0, 10),
    dateTo: rawDateTo.slice(0, 10),
  };
}
