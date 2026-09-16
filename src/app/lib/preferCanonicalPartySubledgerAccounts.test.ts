/**
 * PreferCanonicalPartySubledgerAccounts — unit tests
 */

import { describe, expect, it } from 'vitest';
import {
  filterPreferCanonicalPartySubledgerAccounts,
  isCanonicalPartySubledgerCode,
  resolveCanonicalPartySubledgerAccountId,
} from './preferCanonicalPartySubledgerAccounts';

describe('preferCanonicalPartySubledgerAccounts', () => {
  const farooqLegacy = {
    id: 'legacy-210177',
    code: '210177',
    linked_contact_id: 'contact-farooq',
    isActive: true,
  };
  const farooqAp = {
    id: 'ap-supzhd0177',
    code: 'AP-SUPZHD0177',
    linked_contact_id: 'contact-farooq',
    isActive: true,
  };
  const cash = { id: 'cash', code: '1010', linked_contact_id: null, isActive: true };

  it('detects AP-/AR- as canonical', () => {
    expect(isCanonicalPartySubledgerCode('AP-SUPZHD0177')).toBe(true);
    expect(isCanonicalPartySubledgerCode('AR-CUS0001')).toBe(true);
    expect(isCanonicalPartySubledgerCode('210177')).toBe(false);
  });

  it('hides legacy leaf when AP-* sibling exists for same contact', () => {
    const out = filterPreferCanonicalPartySubledgerAccounts([farooqLegacy, farooqAp, cash]);
    expect(out.map((a) => a.id)).toEqual(['ap-supzhd0177', 'cash']);
  });

  it('keeps both when no canonical sibling', () => {
    const onlyLegacy = { ...farooqLegacy, linked_contact_id: 'solo' };
    const out = filterPreferCanonicalPartySubledgerAccounts([onlyLegacy, cash]);
    expect(out.map((a) => a.id)).toEqual(['legacy-210177', 'cash']);
  });

  it('resolves legacy selection to AP-* id', () => {
    expect(
      resolveCanonicalPartySubledgerAccountId([farooqLegacy, farooqAp], farooqLegacy.id),
    ).toBe(farooqAp.id);
    expect(resolveCanonicalPartySubledgerAccountId([farooqLegacy, farooqAp], farooqAp.id)).toBe(
      farooqAp.id,
    );
  });
});
