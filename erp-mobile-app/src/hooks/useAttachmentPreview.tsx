import { useCallback, useState } from 'react';
import { AttachmentPreviewModal } from '../components/sales/AttachmentPreviewModal';
import type { NormalizedAttachment } from '../lib/normalizeAttachments';

export function useAttachmentPreview() {
  const [attachmentPreviewList, setAttachmentPreviewList] = useState<NormalizedAttachment[] | null>(
    null,
  );
  const [attachmentPreviewStart, setAttachmentPreviewStart] = useState(0);

  const openAttachmentPreview = useCallback(
    (items: NormalizedAttachment[], startIndex = 0) => {
      if (!items.length) return;
      setAttachmentPreviewList(items);
      setAttachmentPreviewStart(startIndex);
    },
    [],
  );

  const closeAttachmentPreview = useCallback(() => {
    setAttachmentPreviewList(null);
    setAttachmentPreviewStart(0);
  }, []);

  const AttachmentPreviewPortal =
    attachmentPreviewList && attachmentPreviewList.length > 0 ? (
      <AttachmentPreviewModal
        attachments={attachmentPreviewList}
        initialIndex={attachmentPreviewStart}
        isOpen
        onClose={closeAttachmentPreview}
      />
    ) : null;

  return {
    openAttachmentPreview,
    closeAttachmentPreview,
    AttachmentPreviewPortal,
  };
}
