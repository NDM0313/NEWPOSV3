/**
 * Normalize phone numbers for WhatsApp wa.me URLs (web ERP).
 * Display formatting unchanged in UI; strip only when sharing.
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
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** Prefer mobile, then phone — raw display string (normalized at share time). */
export function getContactWhatsAppPhone(c: {
  phone?: string | null;
  mobile?: string | null;
  contact_number?: string | null;
}): string {
  const m = (c.mobile ?? '').trim();
  if (m) return m;
  const p = (c.phone ?? '').trim();
  if (p) return p;
  return (c.contact_number ?? '').trim();
}
