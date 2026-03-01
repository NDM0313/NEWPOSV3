export type Screen =
  | 'login'
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
  | 'reports'
  | 'settings';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'staff' | 'viewer';
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
