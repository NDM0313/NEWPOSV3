import React, { useState } from 'react';
import { Plus, Shield, Users, Edit, Trash2, ChevronRight } from 'lucide-react';
import { Button } from "../ui/button";
import { cn } from "../ui/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Checkbox } from "../ui/checkbox";

const mockRoles = [
  { id: 1, name: 'Administrator', users: 3, color: 'red', description: 'Full system access', permissions: ['all'] },
  { id: 2, name: 'Manager', users: 5, color: 'purple', description: 'Manage operations', permissions: ['sales', 'purchases', 'products', 'reports'] },
  { id: 3, name: 'Cashier', users: 8, color: 'blue', description: 'Handle sales and POS', permissions: ['sales', 'pos'] },
  { id: 4, name: 'Inventory Clerk', users: 4, color: 'green', description: 'Manage stock and products', permissions: ['products', 'stock', 'purchases'] },
];

const permissionCategories = [
  {
    category: 'Sales',
    permissions: ['View Sales', 'Create Sales', 'Edit Sales', 'Delete Sales', 'View Reports']
  },
  {
    category: 'Purchases',
    permissions: ['View Purchases', 'Create Purchases', 'Edit Purchases', 'Delete Purchases']
  },
  {
    category: 'Products',
    permissions: ['View Products', 'Create Products', 'Edit Products', 'Delete Products']
  },
  {
    category: 'Contacts',
    permissions: ['View Contacts', 'Create Contacts', 'Edit Contacts', 'Delete Contacts']
  },
  {
    category: 'Users',
    permissions: ['View Users', 'Create Users', 'Edit Users', 'Delete Users']
  },
  {
    category: 'Accounting',
    permissions: ['View Accounts', 'Create Transactions', 'View Reports', 'Manage Expenses']
  }
];

export const RolesDashboard = () => {
  const [isAddRoleOpen, setIsAddRoleOpen] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  const togglePermission = (permission: string) => {
    setSelectedPermissions(prev => 
      prev.includes(permission) 
        ? prev.filter(p => p !== permission)
        : [...prev, permission]
    );
  };

  const toggleCategory = (category: string) => {
    const categoryPerms = permissionCategories.find(c => c.category === category)?.permissions || [];
    const allSelected = categoryPerms.every(p => selectedPermissions.includes(p));
    
    if (allSelected) {
      setSelectedPermissions(prev => prev.filter(p => !categoryPerms.includes(p)));
    } else {
      setSelectedPermissions(prev => [...new Set([...prev, ...categoryPerms])]);
    }
  };

  const getColorClasses = (color: string) => {
    const colors: Record<string, string> = {
      red: 'bg-red-500/10 text-red-400 border-red-500/20',
      purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      green: 'bg-green-500/10 text-green-400 border-green-500/20',
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Roles & Permissions</h2>
          <p className="text-gray-400 text-sm">Define user roles and their access levels.</p>
        </div>
        <Dialog open={isAddRoleOpen} onOpenChange={setIsAddRoleOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-500 text-white gap-2 shadow-lg shadow-blue-500/20">
              <Plus size={18} />
              Create New Role
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">Create New Role</DialogTitle>
              <DialogDescription className="text-gray-400">
                Define a new role and assign permissions.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 mt-4">
              <div className="space-y-2">
                <Label htmlFor="role-name" className="text-gray-200">Role Name</Label>
                <Input 
                  id="role-name" 
                  placeholder="e.g., Senior Manager" 
                  className="bg-gray-950 border-gray-800 text-white" 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-gray-200">Description</Label>
                <Input 
                  id="description" 
                  placeholder="Brief description of this role" 
                  className="bg-gray-950 border-gray-800 text-white" 
                />
              </div>

              <div className="space-y-4">
                <Label className="text-gray-200 text-lg">Permissions</Label>
                
                {permissionCategories.map(({ category, permissions }) => {
                  const allSelected = permissions.every(p => selectedPermissions.includes(p));
                  const someSelected = permissions.some(p => selectedPermissions.includes(p));
                  
                  return (
                    <div key={category} className="border border-gray-800 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Checkbox 
                            checked={allSelected}
                            onCheckedChange={() => toggleCategory(category)}
                            className="border-gray-700"
                          />
                          <Label className="text-white font-semibold cursor-pointer">
                            {category}
                          </Label>
                        </div>
                        <span className="text-xs text-gray-500">
                          {permissions.filter(p => selectedPermissions.includes(p)).length} / {permissions.length} selected
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 pl-7">
                        {permissions.map(permission => (
                          <div key={permission} className="flex items-center gap-2">
                            <Checkbox 
                              checked={selectedPermissions.includes(permission)}
                              onCheckedChange={() => togglePermission(permission)}
                              className="border-gray-700"
                            />
                            <Label className="text-gray-400 text-sm cursor-pointer">
                              {permission}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsAddRoleOpen(false)}
                  className="flex-1 border-gray-700 text-gray-300"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1 bg-blue-600 hover:bg-blue-500"
                  onClick={() => setIsAddRoleOpen(false)}
                >
                  Create Role
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Card */}
      <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm font-medium">Total Roles</p>
            <h3 className="text-3xl font-bold text-white mt-1">{mockRoles.length}</h3>
            <p className="text-gray-500 text-xs mt-1">Managing {mockRoles.reduce((acc, r) => acc + r.users, 0)} users</p>
          </div>
          <Shield size={48} className="text-blue-500 opacity-50" />
        </div>
      </div>

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockRoles.map((role) => (
          <div 
            key={role.id}
            className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-all group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center border",
                getColorClasses(role.color)
              )}>
                <Shield size={24} />
              </div>
              
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-white">
                  <Edit size={14} />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-red-400">
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>

            <h3 className="text-xl font-bold text-white mb-2">{role.name}</h3>
            <p className="text-gray-400 text-sm mb-4">{role.description}</p>

            <div className="flex items-center justify-between pt-4 border-t border-gray-800">
              <div className="flex items-center gap-2 text-gray-400">
                <Users size={16} />
                <span className="text-sm">{role.users} users</span>
              </div>
              <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300 h-auto p-0">
                View Details <ChevronRight size={14} className="ml-1" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
