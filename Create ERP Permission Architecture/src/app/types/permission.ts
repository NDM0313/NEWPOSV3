export type Role = 'owner' | 'admin' | 'manager' | 'salesman' | 'user';

export type Module = 
  | 'sales'
  | 'payments'
  | 'ledger'
  | 'inventory'
  | 'accounts'
  | 'reports'
  | 'users'
  | 'settings';

export type Action = 
  | 'view_own'
  | 'view_branch'
  | 'view_company'
  | 'create'
  | 'edit'
  | 'delete'
  | 'approve'
  | 'receive'
  | 'manage';

export type VisibilityMode = 'own' | 'branch' | 'company';

export interface RolePermission {
  role: Role;
  module: Module;
  action: Action;
  allowed: boolean;
}

export interface RoleConfig {
  role: Role;
  color: string;
  icon: string;
  description: string;
  level: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  branches: string[];
  active: boolean;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  location: string;
  active: boolean;
}

export interface PermissionCheck {
  user: User;
  module: Module;
  action: Action;
  result: boolean;
  reason: string;
}
