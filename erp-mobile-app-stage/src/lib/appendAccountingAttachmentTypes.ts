export type AttachmentWriteTarget =
  | {
      kind: 'payment';
      paymentId: string;
      storageRefId: string;
      referenceType?: string | null;
      referenceId?: string | null;
    }
  | {
      kind: 'journal';
      journalEntryId: string;
      referenceType?: string | null;
      referenceId?: string | null;
    };

export interface ResolveAttachmentTargetParams {
  paymentId?: string | null;
  journalEntryId?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
}
