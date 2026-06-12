import { useCallback } from 'react';
import { toast } from 'sonner';
import { APP_BUILD_COMMIT, APP_VERSION, registerAppVersionTap } from '@/app/lib/developerMode';

/**
 * Tap / click 7 times within a few seconds to unlock hidden Developer Tools (device-local).
 */
export function AppVersionTapTarget() {
  const onClick = useCallback(() => {
    const r = registerAppVersionTap();
    if (r.justUnlocked) {
      toast.success('Developer Tools enabled', {
        description: 'Scroll to the Developer Tools section below.',
      });
    }
  }, []);

  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left w-full text-xs text-gray-500 hover:text-gray-400 transition-colors py-1 px-0 border-0 bg-transparent cursor-pointer"
    >
      App version <span className="font-mono text-gray-400">{APP_VERSION}</span>
      {' · '}
      build <span className="font-mono text-gray-500">{APP_BUILD_COMMIT}</span>
      <span className="sr-only">. Tap seven times to unlock developer tools.</span>
    </button>
  );
}
