/** Session bridge: Accounting → Contacts party statement (modern). */
export const CONTACTS_PARTY_DRILLDOWN_KEY = 'newpos_contacts_party_drilldown_v1';

export type ContactsPartyDrilldownPayload = {
  contactId: string;
  /** Used to switch Contacts tab so the row is visible */
  tabHint?: 'customer' | 'supplier' | 'worker' | 'all';
};

export function setContactsPartyDrilldown(payload: ContactsPartyDrilldownPayload): void {
  try {
    sessionStorage.setItem(CONTACTS_PARTY_DRILLDOWN_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}
