/**
 * Radix Dialog/Sheet uses react-remove-scroll which adds `block-interactivity-*` on
 * document.body. If a modal unmounts abruptly (HMR, fast navigation, nested drawers),
 * that class can remain and the whole ERP becomes unclickable with no visible overlay.
 */
function bodyHasScrollLockClass(): boolean {
  return [...document.body.classList].some(
    (cls) => cls.startsWith('block-interactivity-') || cls.startsWith('allow-interactivity-'),
  );
}

function hasOpenRadixOverlay(): boolean {
  return document.querySelectorAll(
    '[data-slot="sheet-overlay"][data-state="open"], [data-slot="dialog-overlay"][data-state="open"]',
  ).length > 0;
}

/** True when scroll-lock classes remain but no modal overlay is actually open. */
export function shouldClearStuckModalLocks(): boolean {
  if (typeof document === 'undefined') return false;
  if (bodyHasScrollLockClass() && !hasOpenRadixOverlay()) return true;

  // Orphan open overlays without matching open content (stuck animation / state desync)
  const openOverlays = document.querySelectorAll(
    '[data-slot="sheet-overlay"][data-state="open"], [data-slot="dialog-overlay"][data-state="open"]',
  );
  for (const overlay of openOverlays) {
    const portal = overlay.parentElement;
    const openContent = portal?.querySelector(
      '[data-slot="sheet-content"][data-state="open"], [data-slot="dialog-content"][data-state="open"]',
    );
    if (!openContent) return true;
  }

  return false;
}

export function clearStuckModalLocks(): void {
  if (typeof document === 'undefined') return;

  [...document.body.classList].forEach((cls) => {
    if (cls.startsWith('block-interactivity-') || cls.startsWith('allow-interactivity-')) {
      document.body.classList.remove(cls);
    }
  });

  document.querySelectorAll('[class*="allow-interactivity-"]').forEach((el) => {
    [...el.classList].forEach((cls) => {
      if (cls.startsWith('allow-interactivity-')) {
        el.classList.remove(cls);
      }
    });
  });

  document.body.style.pointerEvents = '';
  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';
  document.body.removeAttribute('data-scroll-locked');
  document.documentElement.removeAttribute('data-scroll-locked');

  document
    .querySelectorAll('[data-slot="sheet-overlay"][data-state="closed"], [data-slot="dialog-overlay"][data-state="closed"]')
    .forEach((el) => {
      el.parentElement?.removeChild(el);
    });
}
