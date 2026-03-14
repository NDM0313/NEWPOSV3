/**
 * Hook for formatDate/formatDateTime using company settings.
 * Use everywhere for date/time display - no hardcoded locale or timezone.
 */
import { useSettings } from '@/app/context/SettingsContext';
import { formatDate as formatDateUtil, formatDateTime as formatDateTimeUtil, formatTime as formatTimeUtil } from '@/app/utils/formatDate';

export const useFormatDate = () => {
  const { company } = useSettings();
  const dateFormat = company?.dateFormat || 'DD/MM/YYYY';
  const timeFormat = company?.timeFormat || '12h';
  const timezone = company?.timezone || 'Asia/Karachi';

  const formatDate = (date: Date | string | number) =>
    formatDateUtil(date, dateFormat, timezone);

  const formatTime = (date: Date | string | number) =>
    formatTimeUtil(date, timeFormat, timezone);

  const formatDateTime = (date: Date | string | number) =>
    formatDateTimeUtil(date, dateFormat, timeFormat, timezone);

  return { formatDate, formatTime, formatDateTime, dateFormat, timeFormat, timezone };
};
