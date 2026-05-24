import { useEffect, useState } from 'react';
import { ImageOff, Image as ImageIcon, Loader2 } from 'lucide-react';
import { extractProductImageStoragePath, getProductImageDisplayUrl } from '../../utils/productImageUpload';

interface ProductImageProps {
  src: string | undefined | null;
  alt?: string;
  className?: string;
  placeholderClassName?: string;
  /** List thumb: explicit empty / loading / loaded states. */
  variant?: 'thumb' | 'inline';
}

/**
 * Product thumbnail: signs product-images bucket URLs when the bucket is private.
 */
export function ProductImage({
  src,
  alt = '',
  className = 'w-full h-full object-cover',
  placeholderClassName = 'text-[#4B5563]',
  variant = 'thumb',
}: ProductImageProps) {
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    setLoadFailed(false);
    setDisplayUrl(null);
    if (!src) {
      setLoading(false);
      return;
    }
    const path = extractProductImageStoragePath(src);
    if (path) {
      let cancelled = false;
      setLoading(true);
      getProductImageDisplayUrl(src).then((url) => {
        if (cancelled) return;
        if (!url) {
          setLoadFailed(true);
          setDisplayUrl(null);
        } else {
          setDisplayUrl(url);
        }
        setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }
    setLoading(false);
    setDisplayUrl(src);
  }, [src]);

  if (variant === 'thumb') {
    if (!src) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-0.5 border border-dashed border-[#4B5563] rounded-lg bg-[#0B1120]/80">
          <ImageOff size={18} className="text-[#6B7280]" />
          <span className="text-[9px] text-[#6B7280] leading-none">No photo</span>
        </div>
      );
    }
    if (loading && !displayUrl) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-[#1F2937]">
          <Loader2 size={18} className="text-[#6B7280] animate-spin" />
        </div>
      );
    }
    if (loadFailed || !displayUrl) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-0.5 border border-dashed border-[#4B5563] rounded-lg bg-[#0B1120]/80">
          <ImageOff size={18} className="text-[#6B7280]" />
          <span className="text-[9px] text-[#6B7280] leading-none">No photo</span>
        </div>
      );
    }
    return (
      <img
        src={displayUrl}
        alt={alt}
        className={className}
        onError={() => setLoadFailed(true)}
      />
    );
  }

  if (!src || loadFailed) {
    return <ImageIcon size={20} className={placeholderClassName} />;
  }

  const url = displayUrl || src;

  return (
    <img
      src={url}
      alt={alt}
      className={className}
      onError={() => setLoadFailed(true)}
    />
  );
}
