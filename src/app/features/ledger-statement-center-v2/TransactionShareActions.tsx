import { Eye, FileText, MessageCircle } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { ledgerRowHasOpenableSourceDocument } from '@/app/lib/ledgerStatementV2SourceDocument';
import type { LedgerStatementV2Row } from './types';

interface TransactionShareActionsProps {
  row: LedgerStatementV2Row;
  onView: (row: LedgerStatementV2Row) => void;
  onWhatsApp: (row: LedgerStatementV2Row) => void;
  onOpenSourceDocument?: (row: LedgerStatementV2Row) => void;
  disabled?: boolean;
}

export function TransactionShareActions({
  row,
  onView,
  onWhatsApp,
  onOpenSourceDocument,
  disabled,
}: TransactionShareActionsProps) {
  const showDoc = Boolean(onOpenSourceDocument) && ledgerRowHasOpenableSourceDocument(row);

  return (
    <div className="flex items-center gap-0.5">
      {showDoc ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-gray-400 hover:text-white disabled:opacity-40"
          title="Open sale/purchase"
          disabled={disabled}
          onClick={() => onOpenSourceDocument?.(row)}
        >
          <FileText size={15} />
        </Button>
      ) : null}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-gray-400 hover:text-white disabled:opacity-40"
        title="View details"
        disabled={disabled}
        onClick={() => onView(row)}
      >
        <Eye size={15} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-gray-400 hover:text-white disabled:opacity-40"
        title="Share on WhatsApp"
        disabled={disabled}
        onClick={() => onWhatsApp(row)}
      >
        <MessageCircle size={15} className="text-green-500" />
      </Button>
    </div>
  );
}
