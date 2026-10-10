import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useEdgeSwipeBack } from '../../hooks/useEdgeSwipeBack';
import { registerMobileBackHandler } from '../../lib/mobileBackPress';

interface SwipeBackShellProps {
  children: ReactNode;
  onBack: () => void;
  disabled?: boolean;
  className?: string;
}

export function SwipeBackShell({ children, onBack, disabled = false, className = '' }: SwipeBackShellProps) {
  const ref = useEdgeSwipeBack({ onBack, disabled });

  useEffect(() => {
    if (disabled) return;
    return registerMobileBackHandler(() => {
      onBack();
      return true;
    });
  }, [disabled, onBack]);

  return (
    <div ref={ref} className={`min-h-0 ${className}`}>
      {children}
    </div>
  );
}
