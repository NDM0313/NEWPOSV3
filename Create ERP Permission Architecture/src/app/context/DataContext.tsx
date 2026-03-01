import { createContext, useContext, useState, ReactNode } from 'react';
import { RolePermission, User, Branch } from '../types/permission';
import { defaultPermissions as initialPermissions, mockUsers as initialUsers, mockBranches as initialBranches } from '../data/mockData';

interface DataContextType {
  permissions: RolePermission[];
  users: User[];
  branches: Branch[];
  updatePermission: (permission: RolePermission) => void;
  addUser: (user: User) => void;
  updateUser: (user: User) => void;
  deleteUser: (id: string) => void;
  addBranch: (branch: Branch) => void;
  updateBranch: (branch: Branch) => void;
  deleteBranch: (id: string) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [permissions, setPermissions] = useState<RolePermission[]>(initialPermissions);
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [branches, setBranches] = useState<Branch[]>(initialBranches);

  const updatePermission = (permission: RolePermission) => {
    setPermissions(prev => {
      const index = prev.findIndex(
        p => p.role === permission.role && 
            p.module === permission.module && 
            p.action === permission.action
      );
      
      if (index >= 0) {
        const newPerms = [...prev];
        newPerms[index] = permission;
        return newPerms;
      } else {
        return [...prev, permission];
      }
    });
  };

  const addUser = (user: User) => {
    setUsers(prev => [...prev, user]);
  };

  const updateUser = (user: User) => {
    setUsers(prev => prev.map(u => u.id === user.id ? user : u));
  };

  const deleteUser = (id: string) => {
    setUsers(prev => prev.filter(u => u.id !== id));
  };

  const addBranch = (branch: Branch) => {
    setBranches(prev => [...prev, branch]);
  };

  const updateBranch = (branch: Branch) => {
    setBranches(prev => prev.map(b => b.id === branch.id ? branch : b));
  };

  const deleteBranch = (id: string) => {
    setBranches(prev => prev.filter(b => b.id !== id));
  };

  return (
    <DataContext.Provider value={{
      permissions,
      users,
      branches,
      updatePermission,
      addUser,
      updateUser,
      deleteUser,
      addBranch,
      updateBranch,
      deleteBranch,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within DataProvider');
  }
  return context;
}
