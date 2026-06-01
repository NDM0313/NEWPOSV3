import type { Contact } from '../api/contacts';
import { getContactDisplayPhone } from '../api/contacts';

export interface PickerCustomer {
  id: string;
  name: string;
  phone: string;
  balance: number;
}

export function contactToPickerCustomer(c: Contact): PickerCustomer {
  return {
    id: c.id,
    name: c.name,
    phone: getContactDisplayPhone(c) || '—',
    balance: c.balance,
  };
}

export function excludeCustomerById<T extends { id: string }>(list: T[], id: string | null | undefined): T[] {
  if (!id) return list;
  return list.filter((c) => c.id !== id);
}
