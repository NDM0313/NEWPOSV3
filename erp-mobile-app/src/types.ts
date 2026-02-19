export type Screen =
  | 'login'
  | 'branch-selection'
  | 'home'
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
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'staff' | 'viewer';
}

export interface Branch {
  id: string;
  name: string;
  location: string;
}

export type BottomNavTab = 'home' | 'sales' | 'pos' | 'contacts' | 'more';
