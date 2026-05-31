import React, { useEffect, useState } from 'react';
import {
  extractProductImageStoragePath,
  getProductImageDisplayUrl,
} from '@/app/utils/productImageUpload';
import { supabase } from '@/lib/supabase';

const PLACEHOLDER_SRC =
  'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23374151" width="100" height="100"/><text x="50%" y="50%" fill="%239ca3af" text-anchor="middle" dy=".3em" font-size="12">?</text></svg>';

interface ProductImageProps {
  src: string | undefined;
  alt?: string;
  className?: string;
}

/**
 * Renders a product image. Signs product-images bucket refs (path-only or full URL) when the bucket is private.
 */
export const ProductImage: React.FC<ProductImageProps> = ({ src, alt = '', className }) => {
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authRevision, setAuthRevision] = useState(0);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'SIGNED_OUT') {
        setAuthRevision((n) => n + 1);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const onCacheCleared = () => setAuthRevision((n) => n + 1);
    window.addEventListener('erp-storage-cache-cleared', onCacheCleared);
    return () => window.removeEventListener('erp-storage-cache-cleared', onCacheCleared);
  }, []);

  useEffect(() => {
    setLoadFailed(false);
    setDisplayUrl(null);
    if (!src) {
      setLoading(false);
      return;
    }
    const storagePath = extractProductImageStoragePath(src);
    if (storagePath) {
      let cancelled = false;
      setLoading(true);
      getProductImageDisplayUrl(src).then((url) => {
        if (cancelled) return;
        setDisplayUrl(url);
        if (!url) setLoadFailed(true);
        setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }
    setLoading(false);
    setDisplayUrl(src);
  }, [src, authRevision]);

  if (!src) return null;

  if (loading && !displayUrl) {
    return (
      <div
        className={className}
        style={{ minWidth: 40, minHeight: 40, background: '#374151' }}
        aria-label={alt}
      />
    );
  }

  if (loadFailed || (extractProductImageStoragePath(src) && !displayUrl)) {
    return <img src={PLACEHOLDER_SRC} alt={alt} className={className} />;
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
};
