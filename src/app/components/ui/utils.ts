import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { APP_TIMEZONE } from "@/lib/appConfig";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format date in app timezone (Pakistan Asia/Karachi = UTC+5)
 * Sale/Purchase save karte waqt yahi use karein – browser timezone par depend nahi
 * @param date - Date object
 * @returns ISO string with +05:00 (e.g., "2026-02-01T10:00:00+05:00")
 */
export function formatDateWithTimezone(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = get('hour');
  const minute = get('minute');
  const second = get('second');
  return `${year}-${month}-${day}T${hour}:${minute}:${second}+05:00`;
}

/**
 * Format date to long format: "15 Jan 2024" (app timezone = Pakistan)
 */
export function formatLongDate(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: APP_TIMEZONE,
  });
}

/**
 * Format date and time in app timezone (Pakistan): "15 Jan 2024" + "01:38 AM"
 */
export function formatDateAndTime(dateString: string | Date): { date: string; time: string } {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return {
    date: date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: APP_TIMEZONE,
    }),
    time: date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: APP_TIMEZONE,
    }),
  };
}

/**
 * Get "today" (midnight) in app timezone (Pakistan)
 */
export function getTodayInAppTimezone(): Date {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '01';
  return new Date(`${get('year')}-${get('month')}-${get('day')}T00:00:00+05:00`);
}

/**
 * Today as YYYY-MM-DD in app timezone (Pakistan)
 */
export function getTodayYYYYMMDD(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '01';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/**
 * Format a Date to YYYY-MM-DD in app timezone (Pakistan).
 * Use when building date ranges for presets (Today, Yesterday, Last 30 Days, etc.)
 */
export function formatDateToYYYYMMDD(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '01';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/**
 * Format boxes or pieces count for display — ALWAYS integer, no decimals.
 * Use everywhere boxes/pieces are shown (inventory, sales, purchases, returns, adjustments, print, ledger).
 */
export function formatBoxesPieces(value: number | null | undefined): string {
  const n = Number(value);
  if (Number.isNaN(n)) return '0';
  return Math.round(n).toLocaleString();
}

/**
 * Format numeric values for display — max 2 decimal places system-wide.
 * Use for stock, quantities, amounts, meters, etc. to avoid floating-point noise (e.g. 265.2999999999997).
 */
export function formatDecimal(value: number | null | undefined, maxFractionDigits: number = 2): string {
  const n = Number(value);
  if (Number.isNaN(n)) return '0.00';
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: maxFractionDigits });
}