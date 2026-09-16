import { Paperclip } from 'lucide-react';
import type { LedgerStatementV2Row } from './types';

interface LedgerReferenceCellProps {
  row: LedgerStatementV2Row;
  onOpen: (row: LedgerStatementV2Row) => void;
  disabled?: boolean;
}

export function LedgerReferenceCell({ row, onOpen, disabled }: LedgerReferenceCellProps) {
  const ref = row.referenceNo || '—';
  const isOpening = row.id === 'opening-balance' || ref === 'Opening Balance';
  if (isOpening) {
    return <span className="text-gray-500">{ref}</span>;
  }
  return (
    <button
      type="button"
      onClick={() => onOpen(row)}
      disabled={disabled}
      className="font-mono text-sm text-blue-400 hover:text-blue-300 hover:underline text-left disabled:opacity-40 disabled:pointer-events-none"
    >
      {ref}
    </button>
  );
}

export function LedgerAttachmentIcon({
  row,
  onPreview,
  disabled,
}: {
  row: LedgerStatementV2Row;
  onPreview: (row: LedgerStatementV2Row) => void;
  disabled?: boolean;
}) {
  if (!row.hasAttachments) return <span className="text-gray-700">—</span>;
  return (
    <button
      type="button"
      onClick={() => onPreview(row)}
      disabled={disabled}
      className="inline-flex items-center justify-center p-1 rounded hover:bg-gray-800 text-amber-400 disabled:opacity-40 disabled:pointer-events-none"
      title="View attachments"
    >
      <Paperclip size={16} />
    </button>
  );
}
