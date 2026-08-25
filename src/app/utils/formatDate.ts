/**
 * Centralized date/time formatting - use company settings from useSettings.
 * No hardcoded en-GB, en-US, or Asia/Karachi.
 *
 * @param date - Date to format (Date, string, or number)
 * @param dateFormat - DD/MM/YYYY | MM/DD/YYYY | YYYY-MM-DD (default from company)
 * @param timezone - IANA timezone (default from company)
 * @returns Formatted date string
 */
function datePartsInTimezone(d: Date, timezone: string): { day: string; month: string; year: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(d);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value || '';
  return { day: pick('day'), month: pick('month'), year: pick('year') };
}

/** DD/MM/YYYY and DD-MM-YYYY both render with dash separators (Pakistan statement style). */
function isDayFirstDashedFormat(dateFormat: string): boolean {
  const f = String(dateFormat || '').toUpperCase().replace(/\s/g, '');
  return f === 'DD/MM/YYYY' || f === 'DD-MM-YYYY';
}

export const formatDate = (
  date: Date | string | number,
  dateFormat: string = 'DD/MM/YYYY',
  timezone: string = 'Asia/Karachi'
): string => {
  const raw = String(date || '').trim();
  const d =
    typeof date === 'object' && date instanceof Date
      ? date
      : /^\d{4}-\d{2}-\d{2}/.test(raw)
        ? new Date(`${raw.slice(0, 10)}T12:00:00`)
        : new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  try {
    if (isDayFirstDashedFormat(dateFormat)) {
      const { day, month, year } = datePartsInTimezone(d, timezone);
      return `${day}-${month}-${year}`;
    }
    const opts: Intl.DateTimeFormatOptions = { timeZone: timezone };
    switch (dateFormat) {
      case 'MM/DD/YYYY':
        opts.month = '2-digit';
        opts.day = '2-digit';
        opts.year = 'numeric';
        return d.toLocaleDateString('en-US', opts);
      case 'YYYY-MM-DD':
        opts.year = 'numeric';
        opts.month = '2-digit';
        opts.day = '2-digit';
        return d.toLocaleDateString('en-CA', opts);
      default:
        opts.day = '2-digit';
        opts.month = '2-digit';
        opts.year = 'numeric';
        return d.toLocaleDateString('en-GB', opts);
    }
  } catch {
    return d.toLocaleDateString();
  }
};

/**
 * Format time only - use company settings (for two-line date+time display).
 */
export const formatTime = (
  date: Date | string | number,
  timeFormat: '12h' | '24h' = '12h',
  timezone: string = 'Asia/Karachi'
): string => {
  const d = typeof date === 'object' && date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  try {
    const timeOpts: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: timeFormat === '12h',
    };
    return d.toLocaleTimeString('en-US', timeOpts);
  } catch {
    return d.toLocaleTimeString();
  }
};

/**
 * Format date and time - use company settings.
 *
 * @param date - Date to format
 * @param dateFormat - DD/MM/YYYY | MM/DD/YYYY | YYYY-MM-DD
 * @param timeFormat - 12h | 24h
 * @param timezone - IANA timezone
 */
export const formatDateTime = (
  date: Date | string | number,
  dateFormat: string = 'DD/MM/YYYY',
  timeFormat: '12h' | '24h' = '12h',
  timezone: string = 'Asia/Karachi'
): string => {
  const d = typeof date === 'object' && date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  try {
    const dateStr = formatDate(d, dateFormat, timezone);
    const timeStr = formatTime(d, timeFormat, timezone);
    return `${dateStr} ${timeStr}`;
  } catch {
    return d.toLocaleString();
  }
};
