import { useState, useEffect } from 'react';
import { getCompanyLogoDisplayUrl } from '@/app/utils/companyLogoUpload';

/** Resolve storage path or external URL to a displayable img src. */
export function useCompanyLogoDisplayUrl(logoUrl: string | null | undefined): string {
  const [displayUrl, setDisplayUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!logoUrl?.trim()) {
      setDisplayUrl('');
      return;
    }
    void getCompanyLogoDisplayUrl(logoUrl).then((url) => {
      if (!cancelled) setDisplayUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [logoUrl]);

  return displayUrl;
}
