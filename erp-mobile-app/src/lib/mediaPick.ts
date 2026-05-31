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

export function dataUrlToFile(dataUrl: string, fileName: string, mimeType?: string): File {
  const [header, base64] = dataUrl.split(',');
  const mime =
    mimeType ||
    header.match(/data:([^;]+)/)?.[1] ||
    (fileName.endsWith('.png') ? 'image/png' : 'image/jpeg');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], fileName, { type: mime });
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
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
      correctOrientation: true,
    });
    if (!photo.dataUrl) return null;
    const ext = photo.format === 'png' ? 'png' : 'jpg';
    const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
    return dataUrlToFile(photo.dataUrl, `photo-${Date.now()}.${ext}`, mime);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/cancel|cancelled|user denied/i.test(msg)) return null;
    throw err;
  }
}
