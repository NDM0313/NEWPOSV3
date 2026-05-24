export const UPLOAD_TIMEOUT_MS = 60_000;

export async function withUploadTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label}: timed out after ${ms / 1000}s`)),
        ms,
      ),
    ),
  ]);
}
