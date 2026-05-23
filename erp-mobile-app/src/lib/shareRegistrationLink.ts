/**
 * Share company-scoped public registration links (WhatsApp, email, native sheet).
 */

export type ContactTypeParam = 'customer' | 'supplier' | 'worker';

export function buildRegistrationLinkMessage(
  companyName: string | undefined,
  url: string,
  contactType: ContactTypeParam,
): string {
  const who =
    contactType === 'customer' ? 'customer' : contactType === 'supplier' ? 'supplier' : 'worker';
  const header = companyName?.trim()
    ? `Register as a ${who} with ${companyName.trim()}`
    : `Register as a ${who}`;
  return `${header}\n\nOpen this link to add your details (name, phone, email, address):\n${url}`;
}

export function cleanWhatsAppDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

export async function shareRegistrationLinkViaNative(opts: {
  title: string;
  text: string;
  url: string;
}): Promise<boolean> {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const share = nav && 'share' in nav ? (nav as Navigator & { share: (d: ShareData) => Promise<void> }).share : undefined;
  if (!share) return false;
  try {
    await share({ title: opts.title, text: opts.text, url: opts.url });
    return true;
  } catch (err) {
    const msg = String((err as { message?: string })?.message || '').toLowerCase();
    if (msg.includes('abort') || msg.includes('cancel')) return true;
    return false;
  }
}

export function openWhatsAppShare(phoneDigits: string | undefined, text: string): void {
  const clean = phoneDigits ? cleanWhatsAppDigits(phoneDigits) : '';
  const url = clean
    ? `https://wa.me/${encodeURIComponent(clean)}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

export function openEmailShare(subject: string, body: string): void {
  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  if (typeof window !== 'undefined') {
    window.location.href = mailto;
  }
}
