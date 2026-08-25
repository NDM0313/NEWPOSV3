/** Stack of back handlers; topmost that returns true consumes the hardware back press. */
const handlers: Array<() => boolean> = [];

export function registerMobileBackHandler(handler: () => boolean): () => void {
  handlers.push(handler);
  return () => {
    const i = handlers.indexOf(handler);
    if (i >= 0) handlers.splice(i, 1);
  };
}

export function dispatchMobileBackPress(): boolean {
  for (let i = handlers.length - 1; i >= 0; i--) {
    try {
      if (handlers[i]()) return true;
    } catch (e) {
      console.warn('[mobileBackPress] handler error:', e);
    }
  }
  return false;
}
