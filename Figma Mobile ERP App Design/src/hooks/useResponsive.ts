import { useState, useEffect } from 'react';

export type DeviceType = 'mobile' | 'tablet';

interface ResponsiveConfig {
  isMobile: boolean;
  isTablet: boolean;
  deviceType: DeviceType;
  columns: {
    dashboard: number;
    moduleGrid: number;
    list: number;
  };
  spacing: {
    page: string;
    card: string;
    grid: string;
  };
  dialogWidth: string;
  maxFormWidth: string;
}

const TABLET_BREAKPOINT = 768; // px

export function useResponsive(): ResponsiveConfig {
  const [width, setWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 375
  );

  useEffect(() => {
    const handleResize = () => {
      setWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isTablet = width >= TABLET_BREAKPOINT;
  const isMobile = !isTablet;
  const deviceType: DeviceType = isTablet ? 'tablet' : 'mobile';

  return {
    isMobile,
    isTablet,
    deviceType,
    columns: {
      // Dashboard module grid
      dashboard: isTablet ? 4 : 2,
      // Module internal grids (like product grid)
      moduleGrid: isTablet ? 3 : 2,
      // List columns
      list: isTablet ? 2 : 1,
    },
    spacing: {
      // Page padding
      page: isTablet ? 'p-6' : 'p-4',
      // Card padding
      card: isTablet ? 'p-6' : 'p-4',
      // Grid gap
      grid: isTablet ? 'gap-6' : 'gap-4',
    },
    // Dialog/Modal widths
    dialogWidth: isTablet ? 'max-w-2xl' : 'max-w-full',
    // Form max width
    maxFormWidth: isTablet ? 'max-w-3xl mx-auto' : 'w-full',
  };
}
