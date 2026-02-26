/**
 * Format packing_details from RPC invoice document item for display.
 */
import type { InvoiceDocumentItem } from '@/app/types/invoiceDocument';
import { formatBoxesPieces } from '@/app/components/ui/utils';

export function formatPackingFromItem(item: InvoiceDocumentItem): string {
  const pd = item.packing_details as { total_boxes?: number; total_pieces?: number; boxes?: Array<{ box_no?: number; pieces?: number[] }> } | undefined;
  if (!pd || typeof pd !== 'object') return '—';
  const totalBoxes = pd.total_boxes ?? 0;
  const totalPieces = pd.total_pieces ?? 0;
  const parts: string[] = [];
  if (Number(totalBoxes) > 0) parts.push(`${formatBoxesPieces(totalBoxes)} Box${Math.round(Number(totalBoxes)) !== 1 ? 'es' : ''}`);
  if (Number(totalPieces) > 0) parts.push(`${formatBoxesPieces(totalPieces)} Piece${Math.round(Number(totalPieces)) !== 1 ? 's' : ''}`);
  return parts.length ? parts.join(', ') : '—';
}
