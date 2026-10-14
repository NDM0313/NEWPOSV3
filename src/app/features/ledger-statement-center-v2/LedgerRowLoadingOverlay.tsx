'use client';

import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent } from '@/app/components/ui/dialog';

export function LedgerRowLoadingOverlay({ open }: { open: boolean }) {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-sm bg-gray-900 border-gray-700 text-white [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="flex flex-col items-center justify-center py-8 gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-blue-400" aria-hidden />
          <p className="text-sm text-gray-300 text-center">Loading transaction details...</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
