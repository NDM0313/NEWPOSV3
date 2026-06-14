import React, { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useNavigation } from '@/app/context/NavigationContext';
import { syncArApDiagnosticsHubTabToUrl } from '@/app/lib/arApDiagnosticsHubTabs';

/** Legacy /admin/financial-trace-center → AR/AP Diagnostics hub Tie-out tab. */
export function FinancialTraceRedirect() {
  const { setCurrentView } = useNavigation();

  useEffect(() => {
    setCurrentView('ar-ap-reconciliation-center');
    syncArApDiagnosticsHubTabToUrl('tie-out');
  }, [setCurrentView]);

  return (
    <div className="min-h-[40vh] flex items-center justify-center bg-[#0B0F19]">
      <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
    </div>
  );
}

export default FinancialTraceRedirect;
