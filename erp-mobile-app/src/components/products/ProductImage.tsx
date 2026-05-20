import { useEffect, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { getProductImageDisplayUrl } from '../../utils/productImageUpload';

const PRODUCT_IMAGES_BUCKET = '/product-images/';

interface ProductImageProps {
  src: string | undefined | null;
  alt?: string;
  className?: string;
  placeholderClassName?: string;
}

/**
 * Product thumbnail: signs product-images bucket URLs when the bucket is private.
 */
export function ProductImage({
  src,
  alt = '',
  className = 'w-full h-full object-cover',
  placeholderClassName = 'text-[#4B5563]',
}: ProductImageProps) {
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!src) {
      setDisplayUrl(null);
      return;
    }
    if (src.includes(PRODUCT_IMAGES_BUCKET)) {
      let cancelled = false;
      getProductImageDisplayUrl(src).then((url) => {
        if (!cancelled) setDisplayUrl(url);
      });
      return () => {
        cancelled = true;
      };
    }
    setDisplayUrl(src);
  }, [src]);

  if (!src) {
    return <ImageIcon size={20} className={placeholderClassName} />;
  }

  const url = displayUrl || src;

  return (
    <img
      src={url}
      alt={alt}
      className={className}
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = 'none';
      }}
    />
  );
}
