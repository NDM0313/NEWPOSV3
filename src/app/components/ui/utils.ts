import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
      hour12: true
    })
  };
}