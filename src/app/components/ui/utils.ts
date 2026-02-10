import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format date with timezone offset to preserve local time
 * This ensures the time selected by user is saved correctly regardless of server timezone
 * @param date - Date object
 * @returns ISO string with timezone offset (e.g., "2026-02-01T05:00:00+05:00")
 */
export function formatDateWithTimezone(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  // Get timezone offset in format +HH:mm or -HH:mm
  const offset = -date.getTimezoneOffset();
  const offsetHours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
  const offsetMinutes = String(Math.abs(offset) % 60).padStart(2, '0');
  const offsetSign = offset >= 0 ? '+' : '-';
  
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${offsetSign}${offsetHours}:${offsetMinutes}`;
}

/**
 * Format date to long format: "15 Jan 2024"
 * @param dateString - Date string in ISO format or parseable format
 * @returns Formatted date string (e.g., "15 Jan 2024")
 */
export function formatLongDate(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

/**
 * Format date and time: "15 Jan 2024" with "01:38 AM" below
 * @param dateString - Date string in ISO format or parseable format
 * @returns Object with date and time strings
 */
export function formatDateAndTime(dateString: string | Date): { date: string; time: string } {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  
  return {
    date: date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }),
    time: date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone // Use local timezone
    })
  };
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