import { useState } from 'react';
import { Layout } from '../components/Layout';
import { Modal } from '../components/Modal';
import { roleConfigs } from '../data/mockData';
import { useData } from '../context/DataContext';
import { Role } from '../types/permission';
import { Mail, Building2, CheckCircle2, XCircle, Plus, Edit2, Trash2, Search } from 'lucide-react';

export function UsersManagement() {
  const { users, branches, addUser, updateUser, deleteUser } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<Role | 'all'>('all');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'user' as Role,
    branches: [] as string[],
    active: true
  });

  const openAddModal = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      role: 'user',
      branches: [],
      active: true
    });
    setIsModalOpen(true);
  };

  const openEditModal = (user: any) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      branches: user.branches,
      active: user.active
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingUser) {
      updateUser({ ...editingUser, ...formData });
    } else {
      addUser({
        id: Date.now().toString(),
        ...formData
      });
    }
    
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this user?')) {
      deleteUser(id);
    }
  };

  const toggleBranch = (branchId: string) => {
    setFormData(prev => ({
      ...prev,
      branches: prev.branches.includes(branchId)
        ? prev.branches.filter(b => b !== branchId)
        : [...prev.branches, branchId]
    }));
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    return matchesSearch && matchesRole;
  });

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Users Management</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2">
              Add, edit, and manage user roles and branch assignments
            </p>
          </div>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors"
          >
            <Plus className="size-5" />
            Add User
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value as Role | 'all')}
              className="px-4 py-3 border-2 border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:border-emerald-500 focus:outline-none"
            >
              <option value="all">All Roles</option>
              {roleConfigs.map(rc => (
                <option key={rc.role} value={rc.role}>{rc.role.toUpperCase()}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Users List */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left p-4 font-semibold text-slate-700 dark:text-slate-300">User</th>
                  <th className="text-left p-4 font-semibold text-slate-700 dark:text-slate-300">Role</th>
                  <th className="text-left p-4 font-semibold text-slate-700 dark:text-slate-300">Assigned Branches</th>
                  <th className="text-center p-4 font-semibold text-slate-700 dark:text-slate-300">Status</th>
                  <th className="text-center p-4 font-semibold text-slate-700 dark:text-slate-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user, index) => {
                  const roleConfig = roleConfigs.find(r => r.role === user.role);
                  const userBranches = branches.filter(b => user.branches.includes(b.id));
                  
                  return (
                    <tr
                      key={user.id}
                      className={index % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-800/50'}
                    >
                      <td className="p-4 border-b border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-3">
                          <div
                            className="size-10 rounded-full flex items-center justify-center font-bold text-white"
                            style={{ backgroundColor: roleConfig?.color }}
                          >
                            {user.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white">{user.name}</div>
                            <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <Mail className="size-3" />
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 border-b border-slate-200 dark:border-slate-700">
                        <span
                          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold text-white"
                          style={{ backgroundColor: roleConfig?.color }}
                        >
                          <span>{roleConfig?.icon}</span>
                          <span className="uppercase">{user.role}</span>
                        </span>
                      </td>
                      <td className="p-4 border-b border-slate-200 dark:border-slate-700">
                        <div className="flex flex-wrap gap-2">
                          {userBranches.length === branches.length ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 rounded-full text-xs font-semibold">
                              <Building2 className="size-3" />
                              All Branches
                            </span>
                          ) : (
                            userBranches.map(branch => (
                              <span
                                key={branch.id}
                                className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded-full text-xs font-semibold"
                              >
                                <Building2 className="size-3" />
                                {branch.name}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="p-4 border-b border-slate-200 dark:border-slate-700 text-center">
                        {user.active ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 rounded-full text-sm font-semibold">
                            <CheckCircle2 className="size-4" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-full text-sm font-semibold">
                            <XCircle className="size-4" />
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="p-4 border-b border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEditModal(user)}
                            className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg transition-colors"
                          >
                            <Edit2 className="size-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(user.id)}
                            className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg transition-colors"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* User Distribution by Role */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {roleConfigs.map(roleConfig => {
            const count = users.filter(u => u.role === roleConfig.role).length;
            return (
              <div
                key={roleConfig.role}
                className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border-2"
                style={{ borderColor: roleConfig.color + '40' }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="size-12 rounded-lg flex items-center justify-center text-2xl"
                    style={{ backgroundColor: roleConfig.color + '20' }}
                  >
                    {roleConfig.icon}
                  </div>
                  <div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 uppercase">Role</div>
                    <div className="font-bold text-slate-900 dark:text-white uppercase">{roleConfig.role}</div>
                  </div>
                </div>
                <div className="text-4xl font-bold" style={{ color: roleConfig.color }}>
                  {count}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  {count === 1 ? 'user' : 'users'}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add/Edit Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingUser ? 'Edit User' : 'Add New User'}
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Role
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })}
                className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:border-emerald-500 focus:outline-none"
              >
                {roleConfigs.map(rc => (
                  <option key={rc.role} value={rc.role}>
                    {rc.icon} {rc.role.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                Assign Branches
              </label>
              <div className="grid grid-cols-2 gap-2">
                {branches.map(branch => (
                  <label
                    key={branch.id}
                    className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                      formData.branches.includes(branch.id)
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                        : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={formData.branches.includes(branch.id)}
                      onChange={() => toggleBranch(branch.id)}
                      className="size-4"
                    />
                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                      {branch.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="active"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                className="size-4"
              />
              <label htmlFor="active" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Active User
              </label>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex-1 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors"
              >
                {editingUser ? 'Update User' : 'Add User'}
              </button>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-3 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white rounded-lg font-semibold transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </Layout>
  );
}