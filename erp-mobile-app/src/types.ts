export type Screen =
  | 'login'
  | 'company-selection'
  | 'branch-selection'
  | 'home'
  | 'dashboard'
  | 'sales'
  | 'purchase'
  | 'rental'
  | 'studio'
  | 'accounts'
  | 'expense'
  | 'inventory'
  | 'products'
  | 'pos'
  | 'contacts'
  |   'reports'
  | 'packing'
  | 'ledger'
  | 'settings';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'manager' | 'staff' | 'viewer' | 'salesman' | 'cashier' | 'developer' | 'super_admin';
  /** Public users.id for user_branches lookup. */
  profileId?: string;
  /** When set, user is locked to this branch (no branch selector). */
  branchId?: string;
  branchLocked?: boolean;
}

export interface Branch {
  id: string;
  name: string;
  location: string;
}

export type BottomNavTab = 'home' | 'sales' | 'pos' | 'contacts' | 'more';
