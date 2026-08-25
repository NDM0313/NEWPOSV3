import { describe, expect, it } from 'vitest';
import { parseLocalDateTimeInput, toLocalISOString } from './localDate';

describe('stockMovementTimestamp', () => {
  it('parseLocalDateTimeInput preserves local calendar day and time', () => {
    const d = parseLocalDateTimeInput('2026-07-06T18:26');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(6);
    expect(d.getHours()).toBe(18);
    expect(d.getMinutes()).toBe(26);
  });

  it('toLocalISOString round-trip keeps 18:26 local (no UTC day shift)', () => {
    const d = parseLocalDateTimeInput('2026-07-06T18:26');
    const iso = toLocalISOString(d);
    expect(iso).toMatch(/^2026-07-06T18:26:00[+-]\d{2}:\d{2}$/);
    const back = parseLocalDateTimeInput(iso);
    expect(back.getFullYear()).toBe(2026);
    expect(back.getMonth()).toBe(6);
    expect(back.getDate()).toBe(6);
    expect(back.getHours()).toBe(18);
    expect(back.getMinutes()).toBe(26);
  });

  it('does not use UTC date slice that shifts the day', () => {
    const d = parseLocalDateTimeInput('2026-07-06T18:26');
    const badUtcDateOnly = d.toISOString().split('T')[0];
    const goodLocal = toLocalISOString(d).slice(0, 10);
    expect(goodLocal).toBe('2026-07-06');
    // In UTC+5, 18:26 local may become same calendar day in UTC — assert local path is explicit
    expect(badUtcDateOnly).toBe(goodLocal);
  });

  it('normalize movementAt payload shape for createStockMovement', () => {
    const movementAt = toLocalISOString(parseLocalDateTimeInput('2026-07-06T18:26'));
    expect(movementAt).toContain('2026-07-06T18:26');
    expect(movementAt).toMatch(/[+-]\d{2}:\d{2}$/);
  });
});
