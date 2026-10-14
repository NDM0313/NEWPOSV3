import { useCallback, useState } from 'react';
import { Paperclip, Eye } from 'lucide-react';
import type { ActionMenuItem } from '../components/common/LongPressCard';
import { AddAttachmentSheet } from '../components/shared/AddAttachmentSheet';
import { useAttachmentPreview } from './useAttachmentPreview';
import {
  loadMergedAttachmentsForJournalEntry,
  loadMergedAttachmentsForTransaction,
} from '../lib/loadMergedAttachments';
import {
  hasNormalizedAttachments,
  normalizeAttachments,
  type NormalizedAttachment,
} from '../lib/normalizeAttachments';
import type { ResolveAttachmentTargetParams } from '../lib/appendAccountingAttachments';
import type { TransactionRow } from '../api/transactions';
import { usesSingleAccountingAttachmentPolicy } from '../lib/accountingAttachmentPolicy';

export function transactionShowsAttachmentIcon(tx: TransactionRow): boolean {
  if (hasNormalizedAttachments(tx.attachments)) return true;
  const rt = (tx.referenceType || '').toLowerCase();
  return (rt === 'expense' || rt === 'expense_payment') && !!tx.referenceId;
}

export interface AccountingAttachmentRowParams extends ResolveAttachmentTargetParams {
  /** For payment timeline rows */
  transactionRow?: TransactionRow;
  /** Quick flag from list API */
  hasAttachments?: boolean;
}

export function useAccountingAttachmentActions(companyId: string | null, branchId?: string | null) {
  const { openAttachmentPreview, AttachmentPreviewPortal } = useAttachmentPreview();
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [addTarget, setAddTarget] = useState<ResolveAttachmentTargetParams | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadMergedForParams = useCallback(
    async (params: AccountingAttachmentRowParams): Promise<NormalizedAttachment[]> => {
      if (!companyId) return [];
      if (params.transactionRow) {
        const tx = params.transactionRow;
        if (tx.id.startsWith('journal-')) {
          return loadMergedAttachmentsForJournalEntry(companyId, {
            journalEntryId: tx.journalEntryId ?? tx.id.replace(/^journal-/, ''),
            rowAttachments: tx.attachments,
            referenceType: tx.referenceType,
            referenceId: tx.referenceId,
            paymentId: tx.paymentId,
          });
        }
        return loadMergedAttachmentsForTransaction(companyId, {
          rowAttachments: tx.attachments,
          referenceType: tx.referenceType,
          referenceId: tx.referenceId,
        });
      }
      return loadMergedAttachmentsForJournalEntry(companyId, {
        journalEntryId: params.journalEntryId ?? '',
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        paymentId: params.paymentId,
      });
    },
    [companyId],
  );

  const previewAttachments = useCallback(
    async (params: AccountingAttachmentRowParams) => {
      const items = await loadMergedForParams(params);
      if (items.length) openAttachmentPreview(items, 0);
    },
    [loadMergedForParams, openAttachmentPreview],
  );

  const openAddAttachment = useCallback((params: ResolveAttachmentTargetParams) => {
    setAddTarget(params);
    setAddSheetOpen(true);
  }, []);

  const hasAnyAttachmentHint = useCallback((params: AccountingAttachmentRowParams) => {
    if (params.hasAttachments) return true;
    if (params.transactionRow) return transactionShowsAttachmentIcon(params.transactionRow);
    const rt = String(params.referenceType ?? '').toLowerCase();
    if ((rt === 'expense' || rt === 'expense_payment') && params.referenceId) return true;
    return false;
  }, []);

  const buildLongPressMenuItems = useCallback(
    (
      params: AccountingAttachmentRowParams,
      options?: { canAdd?: boolean; canView?: boolean },
    ): ActionMenuItem[] => {
      const canAdd = options?.canAdd !== false && !!companyId;
      const canView = options?.canView !== false;
      const showView = canView && hasAnyAttachmentHint(params);
      const refType =
        params.referenceType ??
        params.transactionRow?.referenceType ??
        null;
      const singlePolicy = usesSingleAccountingAttachmentPolicy(refType);
      const addLabel =
        singlePolicy && hasAnyAttachmentHint(params) ? 'Replace attachment' : 'Add attachment';
      return [
        {
          label: addLabel,
          icon: <Paperclip className="w-4 h-4" />,
          onClick: () => {
            if (!companyId) return;
            openAddAttachment({
              paymentId: params.paymentId ?? params.transactionRow?.paymentId,
              journalEntryId: params.journalEntryId ?? params.transactionRow?.journalEntryId,
              referenceType: params.referenceType ?? params.transactionRow?.referenceType,
              referenceId: params.referenceId ?? params.transactionRow?.referenceId,
            });
          },
          show: canAdd,
        },
        {
          label: 'View attachments',
          icon: <Eye className="w-4 h-4" />,
          onClick: () => void previewAttachments(params),
          show: showView,
        },
      ];
    },
    [companyId, hasAnyAttachmentHint, openAddAttachment, previewAttachments],
  );

  const AddAttachmentSheetPortal =
    addSheetOpen && addTarget && companyId ? (
      <AddAttachmentSheet
        open
        companyId={companyId}
        branchId={branchId}
        targetParams={addTarget}
        onClose={() => {
          setAddSheetOpen(false);
          setAddTarget(null);
        }}
        onSaved={(warning) => {
          if (warning) setToast(warning);
        }}
      />
    ) : null;

  const ToastBanner =
    toast ? (
      <div className="fixed bottom-28 left-4 right-4 z-[120] mx-auto max-w-md p-3 rounded-lg bg-amber-500/90 text-[#111827] text-sm shadow-lg">
        {toast}
        <button
          type="button"
          className="ml-2 underline font-medium"
          onClick={() => setToast(null)}
        >
          Dismiss
        </button>
      </div>
    ) : null;

  return {
    openAttachmentPreview,
    AttachmentPreviewPortal,
    AddAttachmentSheetPortal,
    ToastBanner,
    previewAttachments,
    openAddAttachment,
    loadMergedForParams,
    transactionShowsAttachmentIcon,
    hasNormalizedAttachments,
    normalizeAttachments,
    buildLongPressMenuItems,
    hasAnyAttachmentHint,
  };
}
