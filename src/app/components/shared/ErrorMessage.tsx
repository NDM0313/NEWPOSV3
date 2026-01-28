import { AlertCircle } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/app/components/ui/utils';

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorMessage({ message, onRetry, className }: ErrorMessageProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center p-8 text-center', className)}>
      <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Data</h3>
      <p className="text-sm text-gray-600 mb-4 max-w-md">{message}</p>
      {onRetry && (
        <Button
          onClick={onRetry}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          Try Again
        </Button>
      )}
    </div>
  );
}
