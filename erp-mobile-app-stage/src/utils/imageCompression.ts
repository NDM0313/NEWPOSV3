export interface CompressImageOptions {
  targetBytes?: number;
  maxDimension?: number;
  minQuality?: number;
}

export interface PrepareAttachmentFilesResult {
  files: File[];
  compressionMessages: string[];
  skippedMessages: string[];
}

const DEFAULT_TARGET_BYTES = 512 * 1024;
const DEFAULT_MAX_DIMENSION = 1920;
const DEFAULT_MIN_QUALITY = 0.55;
const QUALITY_STEPS = [0.85, 0.75, 0.65, DEFAULT_MIN_QUALITY];

function isCompressibleImage(file: File): boolean {
  const mime = (file.type || '').toLowerCase();
  return (
    mime === 'image/jpeg' ||
    mime === 'image/jpg' ||
    mime === 'image/png' ||
    mime === 'image/webp' ||
    mime.startsWith('image/')
  );
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function loadImageBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // fall through to Image element
    }
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to decode image: ${file.name}`));
    };
    img.src = url;
  });
}

function getBitmapSize(bitmap: ImageBitmap | HTMLImageElement): { width: number; height: number } {
  return { width: bitmap.width, height: bitmap.height };
}

function closeBitmap(bitmap: ImageBitmap | HTMLImageElement): void {
  if ('close' in bitmap && typeof bitmap.close === 'function') {
    bitmap.close();
  }
}

function canvasToJpegBlob(
  bitmap: ImageBitmap | HTMLImageElement,
  width: number,
  height: number,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    const canvas =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(width, height)
        : (() => {
            const el = document.createElement('canvas');
            el.width = width;
            el.height = height;
            return el;
          })();

    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
    if (!ctx) {
      resolve(null);
      return;
    }

    ctx.drawImage(bitmap as CanvasImageSource, 0, 0, width, height);

    if (canvas instanceof OffscreenCanvas) {
      canvas
        .convertToBlob({ type: 'image/jpeg', quality })
        .then(resolve)
        .catch(() => resolve(null));
      return;
    }

    (canvas as HTMLCanvasElement).toBlob(
      (blob) => resolve(blob),
      'image/jpeg',
      quality,
    );
  });
}

export async function compressImageIfNeeded(
  file: File,
  opts?: CompressImageOptions,
): Promise<File> {
  const targetBytes = opts?.targetBytes ?? DEFAULT_TARGET_BYTES;
  const maxDimension = opts?.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const minQuality = opts?.minQuality ?? DEFAULT_MIN_QUALITY;

  if (!isCompressibleImage(file)) return file;

  try {
    const bitmap = await loadImageBitmap(file);
    const { width, height } = getBitmapSize(bitmap);
    const maxSide = Math.max(width, height);

    if (file.size <= targetBytes && maxSide <= maxDimension) {
      closeBitmap(bitmap);
      return file;
    }

    let drawW = Math.max(1, Math.round(width * Math.min(maxDimension / maxSide, 1)));
    let drawH = Math.max(1, Math.round(height * Math.min(maxDimension / maxSide, 1)));
    let blob: Blob | null = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      for (const quality of QUALITY_STEPS) {
        if (quality < minQuality) break;
        blob = await canvasToJpegBlob(bitmap, drawW, drawH, quality);
        if (blob && blob.size <= targetBytes) break;
      }
      if (blob && blob.size <= targetBytes) break;
      drawW = Math.max(1, Math.round(drawW / 2));
      drawH = Math.max(1, Math.round(drawH / 2));
    }

    closeBitmap(bitmap);
    if (!blob) return file;

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
    const compressed = new File([blob], `${baseName}.jpg`, {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    });

    if (compressed.size >= file.size && file.size <= targetBytes) return file;
    return compressed;
  } catch (err) {
    console.warn('[compressImageIfNeeded]', (err as Error)?.message ?? err);
    return file;
  }
}

export async function prepareAttachmentFilesForUpload(
  incoming: File[],
  maxBytes: number,
): Promise<PrepareAttachmentFilesResult> {
  const files: File[] = [];
  const compressionMessages: string[] = [];
  const skippedMessages: string[] = [];
  const maxMb = Math.round(maxBytes / (1024 * 1024));

  for (const raw of incoming) {
    if (raw.size > maxBytes) {
      skippedMessages.push(`${raw.name} exceeds ${maxMb}MB. Skipped.`);
      continue;
    }
    const before = raw.size;
    const processed = await compressImageIfNeeded(raw);
    files.push(processed);
    if (processed.size < before * 0.95) {
      compressionMessages.push(`${raw.name}: compressed ${formatBytes(before)} → ${formatBytes(processed.size)}`);
    }
  }

  return { files, compressionMessages, skippedMessages };
}
