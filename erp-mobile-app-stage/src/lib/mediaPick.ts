import { Capacitor } from '@capacitor/core';
import { Filesystem } from '@capacitor/filesystem';

const MIN_CAMERA_BYTES = 1024;

/** True when `accept` allows image capture (camera). */
export function acceptAllowsCamera(accept: string): boolean {
  const a = accept.toLowerCase();
  return (
    a.includes('image') ||
    a.includes('.png') ||
    a.includes('.jpg') ||
    a.includes('.jpeg') ||
    a.includes('.webp') ||
    a.includes('.gif')
  );
}

function isUserCancelledCamera(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /cancel|cancelled|user denied|no image|dismiss/i.test(msg);
}

function stripFileScheme(path: string): string {
  return path.replace(/^file:\/\//i, '');
}

function mimeForPhotoFormat(format: string | undefined): { ext: string; mime: string } {
  const f = (format || 'jpeg').toLowerCase();
  if (f === 'png') return { ext: 'png', mime: 'image/png' };
  if (f === 'heic' || f === 'heif') return { ext: 'heic', mime: 'image/heic' };
  return { ext: 'jpg', mime: 'image/jpeg' };
}

function base64ToBlob(base64: string, mime: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function validateCameraBlob(blob: Blob): void {
  if (blob.size < MIN_CAMERA_BYTES) {
    throw new Error('Photo could not be read — try gallery or retake the picture.');
  }
}

type CameraPhoto = {
  path?: string;
  webPath?: string;
  format?: string;
};

async function readPhotoBlobViaFilesystem(photo: CameraPhoto): Promise<Blob | null> {
  const rawPath = photo.path;
  if (!rawPath) return null;

  const path = stripFileScheme(rawPath);
  const { mime } = mimeForPhotoFormat(photo.format);

  try {
    const { data } = await Filesystem.readFile({ path });
    if (typeof data !== 'string' || !data.length) return null;
    const blob = base64ToBlob(data, mime);
    validateCameraBlob(blob);
    return blob;
  } catch {
    return null;
  }
}

async function readPhotoBlobViaFetch(webPath: string): Promise<Blob> {
  const response = await fetch(webPath);
  if (!response.ok) {
    throw new Error('Could not read photo from camera.');
  }
  const blob = await response.blob();
  validateCameraBlob(blob);
  return blob;
}

/** Convert Capacitor Camera result to a browser File (native APK). */
async function nativePhotoToFile(photo: CameraPhoto): Promise<File> {
  const { ext, mime } = mimeForPhotoFormat(photo.format);

  let blob: Blob | null = null;
  if (photo.path) {
    blob = await readPhotoBlobViaFilesystem(photo);
  }
  if (!blob && photo.webPath) {
    blob = await readPhotoBlobViaFetch(photo.webPath);
  }
  if (!blob && photo.path) {
    const fallbackPath = photo.path.startsWith('http') || photo.path.startsWith('capacitor://')
      ? photo.path
      : photo.webPath;
    if (fallbackPath) {
      blob = await readPhotoBlobViaFetch(fallbackPath);
    }
  }

  if (!blob) {
    throw new Error('Photo could not be read — try gallery or retake the picture.');
  }

  const outMime = blob.type && blob.type.startsWith('image/') ? blob.type : mime;
  const outExt = outMime === 'image/png' ? 'png' : ext === 'heic' ? 'heic' : 'jpg';
  return new File([blob], `photo-${Date.now()}.${outExt}`, {
    type: outMime === 'image/heic' ? 'image/jpeg' : outMime,
  });
}

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|heic|heif)$/i;

/** Accept gallery/camera files; fix empty MIME from native camera. */
export function normalizePickedImageFiles(files: File[]): File[] {
  const out: File[] = [];
  for (const raw of files) {
    if (raw.size < MIN_CAMERA_BYTES) continue;
    const name = raw.name || '';
    const type = (raw.type || '').toLowerCase();
    const looksLikeImage =
      type.startsWith('image/') || IMAGE_EXT.test(name) || name.startsWith('photo-');
    if (!looksLikeImage) continue;

    if (type.startsWith('image/')) {
      out.push(raw);
      continue;
    }

    const ext = (name.match(IMAGE_EXT)?.[1] || 'jpg').toLowerCase();
    const mime =
      ext === 'png'
        ? 'image/png'
        : ext === 'webp'
          ? 'image/webp'
          : ext === 'gif'
            ? 'image/gif'
            : 'image/jpeg';
    out.push(
      new File([raw], name || `photo-${Date.now()}.jpg`, {
        type: mime,
        lastModified: raw.lastModified,
      }),
    );
  }
  return out;
}

/** Capture one photo with the device camera (native Capacitor only). */
export async function capturePhotoWithNativeCamera(): Promise<File | null> {
  if (!Capacitor.isNativePlatform()) return null;

  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');

  const perm = await Camera.checkPermissions();
  if (perm.camera !== 'granted') {
    const req = await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
    if (req.camera !== 'granted') {
      throw new Error('Camera permission is required to take photos.');
    }
  }

  try {
    const photo = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      correctOrientation: true,
    });

    if (!photo.path && !photo.webPath) return null;

    const file = await nativePhotoToFile(photo);
    const normalized = normalizePickedImageFiles([file]);
    return normalized[0] ?? null;
  } catch (err) {
    if (isUserCancelledCamera(err)) return null;
    throw err;
  }
}
