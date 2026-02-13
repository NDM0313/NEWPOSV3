/**
 * Centralized date/time formatting - use company settings from useSettings.
 * No hardcoded en-GB, en-US, or Asia/Karachi.
 *
 * @param date - Date to format (Date, string, or number)
 * @param dateFormat - DD/MM/YYYY | MM/DD/YYYY | YYYY-MM-DD (default from company)
 * @param timezone - IANA timezone (default from company)
 * @returns Formatted date string
 */
export const formatDate = (
  date: Date | string | number,
  dateFormat: string = 'DD/MM/YYYY',
  timezone: string = 'Asia/Karachi'
): string => {
  const d = typeof date === 'object' && date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  try {
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
        return d.toLocaleDateString('en-CA', opts); // en-CA gives YYYY-MM-DD
      case 'DD/MM/YYYY':
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
    const timeOpts: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: timeFormat === '12h',
    };
    const timeStr = d.toLocaleTimeString('en-US', timeOpts);
    return `${dateStr} ${timeStr}`;
  } catch {
    return d.toLocaleString();
  }
};
