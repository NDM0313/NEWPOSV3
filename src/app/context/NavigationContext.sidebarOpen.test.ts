import { describe, expect, it } from 'vitest';
import { parseSidebarOpenStoredValue } from '@/app/lib/sidebarOpenPreference';

describe('parseSidebarOpenStoredValue', () => {
  it('treats 0/false as collapsed', () => {
    expect(parseSidebarOpenStoredValue('0')).toBe(false);
    expect(parseSidebarOpenStoredValue('false')).toBe(false);
  });

  it('treats 1/true as expanded', () => {
    expect(parseSidebarOpenStoredValue('1')).toBe(true);
    expect(parseSidebarOpenStoredValue('true')).toBe(true);
  });

  it('returns null for missing or unknown values', () => {
    expect(parseSidebarOpenStoredValue(null)).toBe(null);
    expect(parseSidebarOpenStoredValue('')).toBe(null);
    expect(parseSidebarOpenStoredValue('maybe')).toBe(null);
  });
});
