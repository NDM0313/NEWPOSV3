import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { ImageOff, Image as ImageIcon, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  extractProductImageStoragePath,
  getProductImageBlobDisplayUrl,
  getProductImageDisplayUrl,
} from '../../utils/productImageUpload';
import { debugLog, debugLogWarn, setLastProductImageDebugRef } from '../../lib/mobileDebugLog';
import { clearStorageDisplayUrlCache } from '../../utils/storageDisplayUrl';

interface ProductImageProps {
  src: string | undefined | null;
  alt?: string;
  className?: string;
  placeholderClassName?: string;
  /** List thumb: explicit empty / loading / loaded states. */
  variant?: 'thumb' | 'inline';
  /** Defer signing/download until the thumb scrolls into view (product lists). */
  deferUntilVisible?: boolean;
}

async function resolveProductDisplayUrl(src: string): Promise<string | null> {
  if (!extractProductImageStoragePath(src)) {
    return Capacitor.isNativePlatform() && src.startsWith('http') ? null : src;
  }
  if (Capacitor.isNativePlatform()) {
    return getProductImageBlobDisplayUrl(src);
  }
  return getProductImageDisplayUrl(src);
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
  deferUntilVisible = false,
}: ProductImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(!deferUntilVisible);
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [authRevision, setAuthRevision] = useState(0);
  const [blobRetried, setBlobRetried] = useState(false);

  useEffect(() => {
    if (!deferUntilVisible) {
      setVisible(true);
      return;
    }
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: '120px', threshold: 0.01 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [deferUntilVisible]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'SIGNED_OUT') {
        clearStorageDisplayUrlCache();
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
    setBlobRetried(false);
    setDisplayUrl(null);
    if (!src || !visible) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLastProductImageDebugRef(src);
    debugLog('ProductImage', 'resolve start', { src: src.slice(0, 120) });
    void resolveProductDisplayUrl(src).then((url) => {
      if (cancelled) return;
      if (!url) {
        setLastProductImageDebugRef(src, 'resolve returned null');
        debugLogWarn('ProductImage', 'resolve failed', src.slice(0, 120));
        setLoadFailed(true);
        setDisplayUrl(null);
      } else {
        setLastProductImageDebugRef(src, null);
        debugLog('ProductImage', 'resolve ok', url.startsWith('blob:') ? 'blob URL' : url.slice(0, 80));
        setDisplayUrl(url);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [src, authRevision, visible]);

  const handleImgError = () => {
    if (loadFailed || blobRetried || !src) {
      setLoadFailed(true);
      return;
    }
    setBlobRetried(true);
    setLoading(true);
    debugLog('ProductImage', 'img onError → blob retry', src.slice(0, 120));
    void getProductImageBlobDisplayUrl(src).then((blobUrl) => {
      setLoading(false);
      if (blobUrl) {
        debugLog('ProductImage', 'blob retry ok', 'blob URL');
        setDisplayUrl(blobUrl);
        setLoadFailed(false);
      } else {
        debugLogWarn('ProductImage', 'blob retry failed', src.slice(0, 120));
        setLoadFailed(true);
      }
    });
  };

  const wrap = (node: ReactNode) =>
    deferUntilVisible ? (
      <div ref={containerRef} className="w-full h-full min-h-0">
        {node}
      </div>
    ) : (
      node
    );

  if (variant === 'thumb') {
    if (!src) {
      return wrap(
        <div className="w-full h-full flex flex-col items-center justify-center gap-0.5 border border-dashed border-[#4B5563] rounded-lg bg-[#0B1120]/80">
          <ImageOff size={18} className="text-[#6B7280]" />
          <span className="text-[9px] text-[#6B7280] leading-none">No photo</span>
        </div>,
      );
    }
    if (!visible || (loading && !displayUrl)) {
      return wrap(
        <div className="w-full h-full flex items-center justify-center bg-[#1F2937]">
          <Loader2 size={18} className="text-[#6B7280] animate-spin" />
        </div>,
      );
    }
    if (loadFailed || !displayUrl) {
      return wrap(
        <div className="w-full h-full flex flex-col items-center justify-center gap-0.5 border border-dashed border-[#4B5563] rounded-lg bg-[#0B1120]/80">
          <ImageOff size={18} className="text-[#6B7280]" />
          <span className="text-[9px] text-[#6B7280] leading-none">No photo</span>
        </div>,
      );
    }
    return wrap(
      <img src={displayUrl} alt={alt} className={className} onError={handleImgError} />,
    );
  }

  if (!src || loadFailed) {
    return <ImageIcon size={20} className={placeholderClassName} />;
  }

  if (!visible || (loading && !displayUrl)) {
    return <Loader2 size={20} className={`animate-spin ${placeholderClassName}`} />;
  }

  const url = displayUrl || src;

  return <img src={url} alt={alt} className={className} onError={handleImgError} />;
}
