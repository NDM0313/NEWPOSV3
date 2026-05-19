/**
 * Export backup ZIP panel.
 */

import React, { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { downloadBackupPackage } from '../backupPackage/exportBackupPackage';
import { toast } from 'sonner';

export interface BackupExportPanelProps {
  companyId: string;
  branchId?: string | null;
  companyName?: string;
  disabled?: boolean;
}

export function BackupExportPanel({
  companyId,
  branchId,
  companyName,
  disabled,
}: BackupExportPanelProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      await downloadBackupPackage({
        companyId,
        branchId: branchId && branchId !== 'all' ? branchId : null,
        companyName,
      });
      toast.success('Backup package downloaded');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-400">
        Downloads a ZIP with manifest.json and per-entity CSV files, including inventory stock
        balances from movement-based stock (same basis as the Stock Report).
      </p>
      <Button
        onClick={() => void handleExport()}
        disabled={disabled || loading || !companyId}
        className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
        Export backup package (ZIP)
      </Button>
    </div>
  );
}
