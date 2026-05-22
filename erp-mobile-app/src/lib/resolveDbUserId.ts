import type { User } from '../types';

/** public.users.id for FK columns (packing_lists.created_by, sale_shipments, courier_shipments). */
export function resolveDbUserId(user: Pick<User, 'profileId'>): string | null {
  return user.profileId?.trim() || null;
}
