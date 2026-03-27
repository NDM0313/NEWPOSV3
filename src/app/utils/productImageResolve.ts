/**
 * Single place to resolve a displayable product image URL from product row shapes
 * (image_urls JSON/array/string, legacy columns). Used by rental booking, POS, etc.
 */
export function getPrimaryProductImageUrl(product: Record<string, unknown> | null | undefined): string {
  if (!product) return '';
  const raw = product.image_urls;
  const urls: string[] = [];
  if (Array.isArray(raw)) {
    for (const u of raw) {
      if (typeof u === 'string' && u.trim()) urls.push(u.trim());
    }
  } else if (typeof raw === 'string' && raw.trim()) {
    const s = raw.trim();
    if (s.startsWith('[') || s.startsWith('{')) {
      try {
        const parsed = JSON.parse(s) as unknown;
        if (Array.isArray(parsed)) {
          for (const u of parsed) {
            if (typeof u === 'string' && u.trim()) urls.push(u.trim());
          }
        }
      } catch {
        urls.push(s);
      }
    } else {
      urls.push(s);
    }
  }
  if (urls.length > 0) return urls[0];

  const single = product.image_url ?? product.thumbnail ?? product.photo_url;
  if (typeof single === 'string' && single.trim()) return single.trim();

  const vars = product.variations as unknown;
  if (Array.isArray(vars) && vars[0] && typeof (vars[0] as Record<string, unknown>).image_url === 'string') {
    const v = (vars[0] as Record<string, unknown>).image_url as string;
    if (v.trim()) return v.trim();
  }

  return '';
}
