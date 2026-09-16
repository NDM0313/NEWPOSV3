import { uploadPaymentAttachments, updatePaymentAttachments } from '../api/paymentAttachments';
import { attachmentUploadWarningMessage } from '../utils/storageUploadErrors';

/**
 * Upload payment attachment files and link them on payments.attachments.
 * Shared by all MobilePaymentSheet submit handlers.
 */
export async function finalizePaymentAttachments(params: {
  companyId: string;
  storageSegment: string;
  paymentId: string;
  files: File[];
}): Promise<{ attachmentWarning: string | null }> {
  const { companyId, storageSegment, paymentId, files } = params;
  if (!files.length) return { attachmentWarning: null };

  let attachmentWarning: string | null = null;
  try {
    const { results, failures } = await uploadPaymentAttachments(
      companyId,
      storageSegment,
      paymentId,
      files,
    );
    if (results.length > 0) {
      const upd = await updatePaymentAttachments(paymentId, results);
      if (upd.error) {
        attachmentWarning = `Payment saved. Attachments uploaded but could not be linked: ${upd.error}`;
      }
    }
    attachmentWarning =
      attachmentUploadWarningMessage(results.length, files.length, failures) ?? attachmentWarning;
  } catch (err) {
    attachmentWarning = `Payment saved. Attachment upload failed: ${(err as Error)?.message ?? 'unknown error'}.`;
  }
  return { attachmentWarning };
}
