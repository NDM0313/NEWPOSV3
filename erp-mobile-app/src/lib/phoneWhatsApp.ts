/**
 * Normalize phone numbers for WhatsApp wa.me / deeplink URLs.
 * Display formatting (dashes, spaces) is unchanged in UI; strip only here.
 */

export function stripPhoneDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

/** Digits suitable for wa.me path; Pakistan 03xx → 923xx when length ≥ 10. */
export function toWhatsAppWaMeDigits(raw: string): string {
  const digits = stripPhoneDigits(raw);
  if (!digits) return '';
  if (digits.startsWith('0') && digits.length >= 10) {
    return `92${digits.slice(1)}`;
  }
  return digits;
}

export function buildWhatsAppUrl(phone: string | null | undefined, text: string): string {
  const digits = phone ? toWhatsAppWaMeDigits(phone) : '';
  const base = 'https://wa.me/';
  if (!digits) {
    return `${base}?text=${encodeURIComponent(text)}`;
  }
  return `${base}${encodeURIComponent(digits)}?text=${encodeURIComponent(text)}`;
}

export function openWhatsAppShare(phone: string | null | undefined, text: string): void {
  const url = buildWhatsAppUrl(phone, text);
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

/** @deprecated Use stripPhoneDigits — kept for LeadToolsSection imports via shareRegistrationLink */
export function cleanWhatsAppDigits(phone: string): string {
  return stripPhoneDigits(phone);
}
