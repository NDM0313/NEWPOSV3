import { FileX } from 'lucide-react';
import { cn } from '@/app/components/ui/utils';

interface EmptyStateProps {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function EmptyState({ 
  title = 'No Data Available', 
  message = 'There is no data to display at this time.',
  icon,
  className 
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center p-12 text-center', className)}>
      {icon || <FileX className="w-16 h-16 text-gray-400 mb-4" />}
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 max-w-md">{message}</p>
    </div>
  );
}
