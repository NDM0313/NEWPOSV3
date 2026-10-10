/** Minimal window polyfill for node:test event-bus specs. */
const eventMap = new Map<string, Set<EventListener>>();

function ensureWindowPolyfill(): void {
  const w = globalThis as typeof globalThis & { window?: Window };
  if (w.window?.addEventListener) return;

  w.window = {
    addEventListener(type: string, listener: EventListener) {
      if (!eventMap.has(type)) eventMap.set(type, new Set());
      eventMap.get(type)!.add(listener);
    },
    removeEventListener(type: string, listener: EventListener) {
      eventMap.get(type)?.delete(listener);
    },
    dispatchEvent(ev: Event) {
      eventMap.get(ev.type)?.forEach((fn) => fn(ev));
      return true;
    },
  } as unknown as Window;
}

ensureWindowPolyfill();
