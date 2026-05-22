import type { ReactNode } from 'react';
import { useEdgeSwipeBack } from '../../hooks/useEdgeSwipeBack';

interface SwipeBackShellProps {
  children: ReactNode;
  onBack: () => void;
  disabled?: boolean;
  className?: string;
}

export function SwipeBackShell({ children, onBack, disabled = false, className = '' }: SwipeBackShellProps) {
  const ref = useEdgeSwipeBack({ onBack, disabled });
  return (
    <div ref={ref} className={`min-h-0 ${className}`}>
      {children}
    </div>
  );
}
