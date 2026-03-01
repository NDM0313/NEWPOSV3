import { RolePermission, RoleConfig, User, Branch } from '../types/permission';

export const roleConfigs: RoleConfig[] = [
  {
    role: 'owner',
    color: '#10b981',
    icon: '👑',
    description: 'Full company access, all branches, all modules, override everything',
    level: 4
  },
  {
    role: 'admin',
    color: '#3b82f6',
    icon: '🛡️',
    description: 'Full company access, can manage users, configure system',
    level: 3
  },
  {
    role: 'manager',
    color: '#f59e0b',
    icon: '📊',
    description: 'Specific branches, view all sales, view ledger, cannot manage users',
    level: 2
  },
  {
    role: 'salesman',
    color: '#f97316',
    icon: '💼',
    description: 'Only assigned branches, configurable sales view, can receive payments',
    level: 1
  }
];

export const defaultPermissions: RolePermission[] = [
  // OWNER - Full Access
  { role: 'owner', module: 'sales', action: 'view_company', allowed: true },
  { role: 'owner', module: 'sales', action: 'create', allowed: true },
  { role: 'owner', module: 'sales', action: 'edit', allowed: true },
  { role: 'owner', module: 'sales', action: 'delete', allowed: true },
  { role: 'owner', module: 'payments', action: 'view_company', allowed: true },
  { role: 'owner', module: 'payments', action: 'receive', allowed: true },
  { role: 'owner', module: 'payments', action: 'edit', allowed: true },
  { role: 'owner', module: 'payments', action: 'delete', allowed: true },
  { role: 'owner', module: 'ledger', action: 'view_company', allowed: true },
  { role: 'owner', module: 'inventory', action: 'view_company', allowed: true },
  { role: 'owner', module: 'inventory', action: 'manage', allowed: true },
  { role: 'owner', module: 'accounts', action: 'view_company', allowed: true },
  { role: 'owner', module: 'accounts', action: 'manage', allowed: true },
  { role: 'owner', module: 'reports', action: 'view_company', allowed: true },
  { role: 'owner', module: 'users', action: 'manage', allowed: true },
  { role: 'owner', module: 'settings', action: 'manage', allowed: true },

  // ADMIN - Almost Full Access
  { role: 'admin', module: 'sales', action: 'view_company', allowed: true },
  { role: 'admin', module: 'sales', action: 'create', allowed: true },
  { role: 'admin', module: 'sales', action: 'edit', allowed: true },
  { role: 'admin', module: 'sales', action: 'delete', allowed: true },
  { role: 'admin', module: 'payments', action: 'view_company', allowed: true },
  { role: 'admin', module: 'payments', action: 'receive', allowed: true },
  { role: 'admin', module: 'payments', action: 'edit', allowed: true },
  { role: 'admin', module: 'payments', action: 'delete', allowed: true },
  { role: 'admin', module: 'ledger', action: 'view_company', allowed: true },
  { role: 'admin', module: 'inventory', action: 'view_company', allowed: true },
  { role: 'admin', module: 'inventory', action: 'manage', allowed: true },
  { role: 'admin', module: 'accounts', action: 'view_company', allowed: true },
  { role: 'admin', module: 'reports', action: 'view_company', allowed: true },
  { role: 'admin', module: 'users', action: 'manage', allowed: true },
  { role: 'admin', module: 'settings', action: 'view_company', allowed: true },

  // MANAGER - Branch Level
  { role: 'manager', module: 'sales', action: 'view_branch', allowed: true },
  { role: 'manager', module: 'sales', action: 'view_own', allowed: false },
  { role: 'manager', module: 'sales', action: 'view_company', allowed: false },
  { role: 'manager', module: 'sales', action: 'create', allowed: true },
  { role: 'manager', module: 'sales', action: 'edit', allowed: true },
  { role: 'manager', module: 'payments', action: 'view_branch', allowed: true },
  { role: 'manager', module: 'payments', action: 'receive', allowed: true },
  { role: 'manager', module: 'ledger', action: 'view_branch', allowed: true },
  { role: 'manager', module: 'inventory', action: 'view_branch', allowed: true },
  { role: 'manager', module: 'reports', action: 'view_branch', allowed: true },
  { role: 'manager', module: 'users', action: 'manage', allowed: false },

  // SALESMAN - Own/Branch Level (Configurable)
  { role: 'salesman', module: 'sales', action: 'view_own', allowed: true },
  { role: 'salesman', module: 'sales', action: 'view_branch', allowed: false },
  { role: 'salesman', module: 'sales', action: 'view_company', allowed: false },
  { role: 'salesman', module: 'sales', action: 'create', allowed: true },
  { role: 'salesman', module: 'sales', action: 'edit', allowed: true },
  { role: 'salesman', module: 'sales', action: 'delete', allowed: false },
  { role: 'salesman', module: 'payments', action: 'receive', allowed: true },
  { role: 'salesman', module: 'payments', action: 'edit', allowed: false },
  { role: 'salesman', module: 'payments', action: 'delete', allowed: false },
  { role: 'salesman', module: 'ledger', action: 'view_own', allowed: true },
  { role: 'salesman', module: 'inventory', action: 'view_branch', allowed: true },

  // USER - Minimal Access
  { role: 'user', module: 'sales', action: 'view_own', allowed: true },
  { role: 'user', module: 'sales', action: 'view_branch', allowed: false },
  { role: 'user', module: 'sales', action: 'view_company', allowed: false },
  { role: 'user', module: 'payments', action: 'receive', allowed: true },
  { role: 'user', module: 'payments', action: 'delete', allowed: false },
];

export const mockBranches: Branch[] = [
  { id: '1', name: 'Main Office', code: 'HQ-001', location: 'Mumbai', active: true },
  { id: '2', name: 'Delhi Branch', code: 'DEL-002', location: 'New Delhi', active: true },
  { id: '3', name: 'Bangalore Office', code: 'BLR-003', location: 'Bangalore', active: true },
  { id: '4', name: 'Pune Branch', code: 'PUN-004', location: 'Pune', active: true },
  { id: '5', name: 'Chennai Office', code: 'CHE-005', location: 'Chennai', active: true },
];

export const mockUsers: User[] = [
  {
    id: '1',
    name: 'Rajesh Kumar',
    email: 'rajesh@company.com',
    role: 'owner',
    branches: ['1', '2', '3', '4', '5'],
    active: true
  },
  {
    id: '2',
    name: 'Priya Sharma',
    email: 'priya@company.com',
    role: 'admin',
    branches: ['1', '2', '3'],
    active: true
  },
  {
    id: '3',
    name: 'Amit Patel',
    email: 'amit@company.com',
    role: 'manager',
    branches: ['1', '2'],
    active: true
  },
  {
    id: '4',
    name: 'Sneha Desai',
    email: 'sneha@company.com',
    role: 'salesman',
    branches: ['2'],
    active: true
  },
  {
    id: '5',
    name: 'Vikram Singh',
    email: 'vikram@company.com',
    role: 'salesman',
    branches: ['3'],
    active: true
  },
  {
    id: '6',
    name: 'Neha Gupta',
    email: 'neha@company.com',
    role: 'user',
    branches: ['4'],
    active: true
  },
];