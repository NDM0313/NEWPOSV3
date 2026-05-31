import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { acceptAllowsCamera, capturePhotoWithNativeCamera } from '../../lib/mediaPick';
import { MediaSourceActionSheet } from './MediaSourceActionSheet';

export interface MediaSourcePickerProps {
  accept: string;
  multiple?: boolean;
  /** Show camera option when accept includes images. Default: derived from accept. */
  allowCamera?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  onError?: (message: string) => void;
  sheetTitle?: string;
  children: (open: () => void) => ReactNode;
}

/**
 * Camera vs gallery sheet. Native APK uses @capacitor/camera for Take photo;
 * browser/PWA uses file input with capture=environment. Gallery uses standard file input.
 */
export function MediaSourcePicker({
  accept,
  multiple = false,
  allowCamera,
  disabled = false,
  onFiles,
  onError,
  sheetTitle,
  children,
}: MediaSourcePickerProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraWebRef = useRef<HTMLInputElement>(null);

  const showCamera = allowCamera ?? acceptAllowsCamera(accept);
  const useNativeCamera = Capacitor.isNativePlatform();

  const emitFiles = useCallback(
    (list: File[]) => {
      if (list.length > 0) onFiles(list);
    },
    [onFiles],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (selected?.length) emitFiles(Array.from(selected));
    e.target.value = '';
  };

  const openGallery = () => {
    if (disabled) return;
    galleryRef.current?.click();
  };

  const openCamera = () => {
    if (disabled) return;
    void (async () => {
      try {
        if (useNativeCamera) {
          const file = await capturePhotoWithNativeCamera();
          if (file) emitFiles([file]);
          return;
        }
        cameraWebRef.current?.click();
      } catch (err) {
        onError?.(err instanceof Error ? err.message : 'Could not open camera.');
      }
    })();
  };

  const openPicker = () => {
    if (disabled) return;
    if (!showCamera) {
      openGallery();
      return;
    }
    setSheetOpen(true);
  };

  return (
    <>
      {children(openPicker)}
      <MediaSourceActionSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCamera={openCamera}
        onGallery={openGallery}
        showCamera={showCamera}
        title={sheetTitle}
      />
      <input
        ref={galleryRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        disabled={disabled}
        onChange={handleInputChange}
      />
      {showCamera && !useNativeCamera && (
        <input
          ref={cameraWebRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          disabled={disabled}
          onChange={handleInputChange}
        />
      )}
    </>
  );
}
