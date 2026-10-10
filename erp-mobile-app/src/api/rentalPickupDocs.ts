import { uploadStorageAttachmentFile } from '../utils/storageAttachmentPipeline';

const BUCKET = 'payment-attachments' as const;

export async function uploadRentalPickupDoc(
  companyId: string,
  rentalId: string,
  field: 'front' | 'back' | 'customer',
  file: File,
): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = `${companyId}/rental-docs/${rentalId}/${field}_${Date.now()}_${safeName}`;
  const { ref } = await uploadStorageAttachmentFile({
    bucket: BUCKET,
    path,
    file,
    upsert: true,
    logTag: 'rental-pickup-doc',
  });
  return ref;
}
