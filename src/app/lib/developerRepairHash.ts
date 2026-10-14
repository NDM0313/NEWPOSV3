/**
 * Stable dry-run hash for Developer Center repair actions.
 */

function sortKeys(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sortKeys);
  const obj = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortKeys(obj[key]);
  }
  return sorted;
}

export function stableRepairJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

/** FNV-1a 32-bit — deterministic, no crypto dependency. */
export function fnv1aHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function computeDryRunHash(
  actionId: string,
  params: Record<string, unknown>,
  before: unknown
): string {
  return fnv1aHash(stableRepairJson({ actionId, params, before }));
}
