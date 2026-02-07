import React, { useEffect, useState } from 'react';
import { getProductImageDisplayUrl } from '@/app/utils/productImageUpload';

const PRODUCT_IMAGES_BUCKET = '/product-images/';

interface ProductImageProps {
  src: string | undefined;
  alt?: string;
  className?: string;
}

/**
 * Renders a product image. If src is from product-images bucket, uses a signed URL so it works when the bucket is private.
 */
export const ProductImage: React.FC<ProductImageProps> = ({ src, alt = '', className }) => {
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!src) {
      setDisplayUrl(null);
      return;
    }
    if (src.includes(PRODUCT_IMAGES_BUCKET)) {
      getProductImageDisplayUrl(src).then(setDisplayUrl);
    } else {
      setDisplayUrl(src);
    }
  }, [src]);

  if (!src) return null;
  const url = displayUrl || src;

  return (
    <img
      src={url}
      alt={alt}
      className={className}
      onError={(e) => {
        (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23374151" width="100" height="100"/><text x="50%" y="50%" fill="%239ca3af" text-anchor="middle" dy=".3em" font-size="12">?</text></svg>';
      }}
    />
  );
};
