/** Supabase storage upload payload — ArrayBuffer avoids WebView stream hangs on compressed Blobs. */
export async function storageUploadBody(file: File): Promise<{
  body: ArrayBuffer;
  contentType: string;
}> {
  return {
    body: await file.arrayBuffer(),
    contentType: file.type || 'application/octet-stream',
  };
}
