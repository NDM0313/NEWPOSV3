import { Capacitor } from '@capacitor/core';

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

/** Capture one photo with the device camera (native Capacitor only). */
export async function capturePhotoWithNativeCamera(): Promise<File | null> {
  if (!Capacitor.isNativePlatform()) return null;

  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');

  const perm = await Camera.checkPermissions();
  if (perm.camera !== 'granted' || perm.photos !== 'granted') {
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

    const path = photo.webPath || photo.path;
    if (!path) return null;

    const response = await fetch(path);
    if (!response.ok) {
      throw new Error('Could not read photo from camera.');
    }
    const blob = await response.blob();
    const ext = photo.format === 'png' ? 'png' : 'jpg';
    const mime = blob.type || (ext === 'png' ? 'image/png' : 'image/jpeg');
    return new File([blob], `photo-${Date.now()}.${ext}`, { type: mime });
  } catch (err) {
    if (isUserCancelledCamera(err)) return null;
    throw err;
  }
}
