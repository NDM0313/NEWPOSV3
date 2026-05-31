import { useCallback, useRef, useState, type ReactNode } from 'react';
import { acceptAllowsCamera } from '../../lib/mediaPick';
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
 * Camera vs gallery sheet. Camera uses file input with capture=environment (works in Capacitor WebView + mobile browsers).
 * Gallery uses standard file input (PDF, multi-select).
 */
export function MediaSourcePicker({
  accept,
  multiple = false,
  allowCamera,
  disabled = false,
  onFiles,
  onError: _onError,
  sheetTitle,
  children,
}: MediaSourcePickerProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const showCamera = allowCamera ?? acceptAllowsCamera(accept);

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
    cameraRef.current?.click();
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
      {showCamera && (
        <input
          ref={cameraRef}
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
