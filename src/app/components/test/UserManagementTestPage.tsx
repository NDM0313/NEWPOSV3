import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  Plus, 
  Edit, 
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useSupabase } from '../../context/SupabaseContext';
import { userService, User as UserType } from '../../services/userService';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { AddUserModal } from '../users/AddUserModal';

export const UserManagementTestPage = () => {
  const { companyId } = useSupabase();
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(false);
  const [addUserModalOpen, setAddUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);

  // Load users
  const loadUsers = useCallback(async () => {
    if (!companyId) return;
    
    setLoading(true);
    try {
      const usersData = await userService.getAllUsers(companyId, { includeInactive: true });
      setUsers(usersData);
    } catch (error) {
      console.error('[USER MANAGEMENT TEST] Error loading users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  // Load users on mount
  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Open modal for new user
  const handleAddUser = () => {
    setEditingUser(null);
    setAddUserModalOpen(true);
  };

  // Open modal for edit
  const handleEditUser = (user: UserType) => {
    setEditingUser(user);
    setAddUserModalOpen(true);
  };

  // Toggle user active status
  const handleToggleActive = async (user: UserType) => {
    try {
      await userService.updateUser(user.id, { is_active: !user.is_active });
      toast.success(`User ${user.is_active ? 'deactivated' : 'activated'}`);
      await loadUsers();
    } catch (error: any) {
      toast.error(`Failed to update user: ${error.message}`);
    }
  };

  // Check if user can be salesman
  const canBeSalesman = (user: UserType) => {
    return (
      user.is_active &&
      (user.can_be_assigned_as_salesman || user.permissions?.canBeAssignedAsSalesman) &&
      (user.permissions?.canCreateSale || user.role === 'admin' || user.role === 'salesman')
    );
  };

  return (
    <div className="h-full flex flex-col bg-[#0B0F17] text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-[#111827] px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">User Management Test</h1>
            <p className="text-sm text-gray-400 mt-1">Test page for user management functionality</p>
          </div>
          <Button 
            onClick={handleAddUser}
            className="bg-blue-600 hover:bg-blue-500"
          >
            <Plus size={16} className="mr-2" /> Add User
          </Button>
        </div>
      </div>

      {/* Main Content - Single Column Layout */}
      <div className="flex-1 overflow-y-auto p-6">
          <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-gray-400">Loading users...</div>
            ) : users.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <Users size={48} className="mx-auto mb-4 text-gray-600" />
                <p className="mb-2">No users found</p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleAddUser}
                >
                  Create First User
                </Button>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-950 border-b border-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Role</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Can Be Salesman</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-800/50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-blue-400 text-sm font-mono font-medium">
                          {user.user_code || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                            <span className="text-blue-400 text-sm font-bold">
                              {user.full_name?.charAt(0).toUpperCase() || 'U'}
                            </span>
                          </div>
                          <div>
                            <span className="text-white text-sm font-medium">{user.full_name || 'No Name'}</span>
                            {user.phone && (
                              <p className="text-xs text-gray-500">{user.phone}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-300 text-sm">{user.email}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={cn(
                          "text-xs font-medium",
                          user.role === 'admin' && "bg-red-500/20 text-red-400 border-red-500/30",
                          user.role === 'manager' && "bg-purple-500/20 text-purple-400 border-purple-500/30",
                          user.role === 'salesman' && "bg-green-500/20 text-green-400 border-green-500/30",
                          user.role === 'staff' && "bg-blue-500/20 text-blue-400 border-blue-500/30",
                          "bg-gray-500/20 text-gray-400 border-gray-500/30"
                        )}>
                          {user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Staff'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge className={cn(
                          "text-xs font-medium",
                          user.is_active 
                            ? "bg-green-500/20 text-green-400 border-green-500/30" 
                            : "bg-gray-500/20 text-gray-400 border-gray-500/30"
                        )}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {canBeSalesman(user) ? (
                          <CheckCircle2 size={16} className="text-green-400 mx-auto" />
                        ) : (
                          <XCircle size={16} className="text-gray-500 mx-auto" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditUser(user)}
                            className="text-xs h-7"
                          >
                            <Edit size={14} className="mr-1" /> Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(user)}
                            className="text-xs h-7"
                          >
                            {user.is_active ? 'Deactivate' : 'Activate'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      {/* Add User Modal - Centered Dialog */}
      <AddUserModal
        open={addUserModalOpen}
        onClose={() => {
          setAddUserModalOpen(false);
          setEditingUser(null);
        }}
        onSuccess={() => {
          loadUsers();
        }}
        editingUser={editingUser}
      />
    </div>
  );
};
