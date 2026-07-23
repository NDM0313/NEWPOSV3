/** e.g. "Sale finalized – Sale DC-0018 - …" → DC-0018 */
export function extractSaleInvoiceNoFromDescription(text: string | null | undefined): string | null {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const saleLabeled = raw.match(/\bSale\s+([A-Z0-9]+-\d+)\b/i);
  if (saleLabeled?.[1]) return saleLabeled[1].toUpperCase();
  const bare = raw.match(/\b((?:DC|SAL|INV|SO|QT)-\d+)\b/i);
  if (bare?.[1]) return bare[1].toUpperCase();
  return null;
}
