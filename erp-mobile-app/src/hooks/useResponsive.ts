import { useState, useEffect } from 'react';

export type DeviceType = 'mobile' | 'tablet';

const TABLET_BREAKPOINT = 768;

export function useResponsive() {
  const [width, setWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 375
  );

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isTablet = width >= TABLET_BREAKPOINT;
  const isMobile = !isTablet;

  return {
    isMobile,
    isTablet,
    deviceType: (isTablet ? 'tablet' : 'mobile') as DeviceType,
    columns: {
      dashboard: isTablet ? 4 : 2,
      moduleGrid: isTablet ? 3 : 2,
      list: isTablet ? 2 : 1,
    },
    spacing: {
      page: isTablet ? 'p-6' : 'p-4',
      card: isTablet ? 'p-6' : 'p-4',
      grid: isTablet ? 'gap-6' : 'gap-4',
    },
    dialogWidth: isTablet ? 'max-w-2xl' : 'max-w-full',
    maxFormWidth: isTablet ? 'max-w-3xl mx-auto' : 'w-full',
  };
}
