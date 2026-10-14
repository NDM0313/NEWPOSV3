import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Switch } from '@/app/components/ui/switch';
import { Button } from '@/app/components/ui/button';
import { Label } from '@/app/components/ui/label';
import {
  isDeveloperModeUnlocked,
  isVerboseApiErrorsEnabled,
  setVerboseApiErrorsEnabled,
  setDeveloperModeUnlocked,
  subscribeDeveloperMode,
  clearClientCaches,
} from '@/app/lib/developerMode';
import { permissionEngine } from '@/app/services/permissionEngine';

export function DeveloperToolsPanel() {
  const [unlocked, setUnlocked] = useState(() => isDeveloperModeUnlocked());
  const [verbose, setVerbose] = useState(() => isVerboseApiErrorsEnabled());

  useEffect(() => {
    return subscribeDeveloperMode(() => {
      setUnlocked(isDeveloperModeUnlocked());
      setVerbose(isVerboseApiErrorsEnabled());
    });
  }, []);

  const onClearCache = useCallback(() => {
    try {
      const { removedKeys } = clearClientCaches();
      permissionEngine.clear();
      toast.success('Local cache cleared', {
        description: `Removed ${removedKeys} localStorage key(s). Session preserved. Reload the page if the UI still looks stale.`,
      });
    } catch (e) {
      toast.error('Failed to clear cache');
    }
  }, []);

  const onVerboseChange = useCallback((checked: boolean) => {
    setVerboseApiErrorsEnabled(checked);
    setVerbose(checked);
    toast.message(checked ? 'Verbose API errors on' : 'Verbose API errors off');
  }, []);

  const onHide = useCallback(() => {
    setDeveloperModeUnlocked(false);
    setUnlocked(false);
    setVerbose(false);
    toast.message('Developer Tools hidden');
  }, []);

  if (!unlocked) return null;

  return (
    <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 p-4 space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-amber-200">Developer Tools</h4>
        <p className="text-xs text-muted-foreground mt-1">
          Local debugging only. Does not change server data. Web ERP has no mobile-style offline sync queue.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <Label className="text-muted-foreground text-sm">Show raw API errors</Label>
          <p className="text-xs text-muted-foreground">Toasts include PostgREST code, details, and hints when available.</p>
        </div>
        <Switch checked={verbose} onCheckedChange={onVerboseChange} />
      </div>

      <div>
        <Button type="button" variant="outline" size="sm" className="border-gray-600 text-gray-200" onClick={onClearCache}>
          Clear local cache
        </Button>
        <p className="text-xs text-muted-foreground mt-2">
          Clears localStorage (except session and developer flags) and sessionStorage, then clears the permission engine cache. You stay signed in.
        </p>
      </div>

      <div className="pt-2 border-t border-border">
        <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={onHide}>
          Hide Developer Tools
        </Button>
      </div>
    </div>
  );
}
