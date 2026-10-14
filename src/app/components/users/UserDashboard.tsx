import React from 'react';
import { Plus, Search, Users, UserCheck, LogIn, MoreVertical, Shield, MapPin, Edit, Trash2, Eye } from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { cn } from "../ui/utils";
import { useNavigation } from '../../context/NavigationContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

const mockUsers = [
  { id: 1, name: 'Ahmed Khan', email: 'ahmed@example.com', role: 'Admin', location: 'Karachi', status: 'Active', lastLogin: '2 hours ago' },
  { id: 2, name: 'Fatima Ali', email: 'fatima@example.com', role: 'Manager', location: 'Lahore', status: 'Active', lastLogin: '5 minutes ago' },
  { id: 3, name: 'Hassan Malik', email: 'hassan@example.com', role: 'Cashier', location: 'Karachi', status: 'Active', lastLogin: '1 day ago' },
  { id: 4, name: 'Sara Ahmed', email: 'sara@example.com', role: 'Inventory Clerk', location: 'Islamabad', status: 'Inactive', lastLogin: '3 days ago' },
  { id: 5, name: 'Bilal Sheikh', email: 'bilal@example.com', role: 'Manager', location: 'Karachi', status: 'Active', lastLogin: '10 minutes ago' },
];

export const UserDashboard = () => {
  const { openDrawer } = useNavigation();

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">User Management</h2>
          <p className="text-muted-foreground text-sm">Manage system users and their permissions.</p>
        </div>
        <Button 
          onClick={() => {
            // TODO: Replace with modal when UserDashboard is updated
            toast.info('Please use Settings → User Management to add users');
          }}
          className="bg-blue-600 hover:bg-blue-500 text-white gap-2 shadow-lg shadow-blue-500/20"
        >
          <Plus size={18} />
          Create New User
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <GlassCard 
          title="Total Users" 
          value="24" 
          subtitle="System Users"
          icon={Users}
          highlightColor="text-blue-400" 
        />
        <GlassCard 
          title="Active Users" 
          value="20" 
          subtitle="Currently active"
          icon={UserCheck}
          highlightColor="text-[var(--erp-money-positive)]"
        />
        <GlassCard 
          title="Logged In Today" 
          value="12" 
          subtitle="+3 from yesterday"
          icon={LogIn}
          highlightColor="text-yellow-400"
        />
      </div>

      {/* Table Section */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-border flex gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input 
              placeholder="Search users..." 
              className="pl-9 bg-input-background border-border text-white focus:border-blue-500" 
            />
          </div>
          <div className="flex gap-2 ml-auto">
             <Button variant="outline" className="border-border text-muted-foreground">Filter</Button>
             <Button variant="outline" className="border-border text-muted-foreground">Export</Button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 text-muted-foreground font-medium border-b border-border">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">Last Login</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {mockUsers.map((user) => (
                <tr key={user.id} className="hover:bg-muted/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border border-border">
                        <AvatarImage src={`https://api.dicebear.com/7.x/avatars/svg?seed=${user.name}`} />
                        <AvatarFallback className="bg-blue-900 text-blue-200">
                          {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-foreground">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-medium border flex items-center gap-1 w-fit",
                      user.role === 'Admin' 
                        ? "bg-red-500/10 text-red-400 border-red-500/20" 
                        : user.role === 'Manager'
                        ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                        : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                    )}>
                      <Shield size={12} />
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin size={14} />
                      {user.location}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {user.lastLogin}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-medium",
                      user.status === 'Active' ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"
                    )}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreVertical size={16} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-card border-border text-white">
                        <DropdownMenuItem className="hover:bg-muted cursor-pointer">
                          <Eye size={14} className="mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem className="hover:bg-muted cursor-pointer">
                          <Edit size={14} className="mr-2" />
                          Edit User
                        </DropdownMenuItem>
                        <DropdownMenuItem className="hover:bg-muted cursor-pointer text-red-400">
                          <Trash2 size={14} className="mr-2" />
                          Delete User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const GlassCard = ({ title, value, subtitle, icon: Icon, highlightColor }: any) => (
  <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-xl shadow-lg relative overflow-hidden">
    <div className="absolute top-0 right-0 p-4 opacity-10">
      <Icon size={64} className="text-white" />
    </div>
    <p className="text-muted-foreground text-sm font-medium">{title}</p>
    <div className="flex items-end gap-3 mt-1 mb-2">
      <h3 className={cn("text-3xl font-bold", highlightColor || "text-white")}>{value}</h3>
    </div>
    <p className="text-muted-foreground text-xs">{subtitle}</p>
  </div>
);
