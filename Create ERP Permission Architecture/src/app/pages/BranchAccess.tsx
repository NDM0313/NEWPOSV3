import { useState } from 'react';
import { Layout } from '../components/Layout';
import { Modal } from '../components/Modal';
import { roleConfigs } from '../data/mockData';
import { useData } from '../context/DataContext';
import { Building2, MapPin, Users, CheckCircle2, Plus, Edit2, Trash2 } from 'lucide-react';

export function BranchAccess() {
  const { users, branches, addBranch, updateBranch, deleteBranch } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    location: '',
    active: true
  });

  const openAddModal = () => {
    setEditingBranch(null);
    setFormData({
      name: '',
      code: '',
      location: '',
      active: true
    });
    setIsModalOpen(true);
  };

  const openEditModal = (branch: any) => {
    setEditingBranch(branch);
    setFormData({
      name: branch.name,
      code: branch.code,
      location: branch.location,
      active: branch.active
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingBranch) {
      updateBranch({ ...editingBranch, ...formData });
    } else {
      addBranch({
        id: Date.now().toString(),
        ...formData
      });
    }
    
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this branch?')) {
      deleteBranch(id);
    }
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Branch Access Control</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2">
              Manage branches and user access across different locations
            </p>
          </div>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors"
          >
            <Plus className="size-5" />
            Add Branch
          </button>
        </div>

        {/* Branches Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {branches.map(branch => {
            const branchUsers = users.filter(u => u.branches.includes(branch.id));
            
            return (
              <div
                key={branch.id}
                className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border-2 border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-600 transition-all overflow-hidden"
              >
                <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 dark:from-emerald-700 dark:to-emerald-800 p-6 text-white">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="size-12 rounded-lg bg-white/20 backdrop-blur flex items-center justify-center">
                        <Building2 className="size-6" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">{branch.name}</h3>
                        <p className="text-emerald-100 text-sm flex items-center gap-1 mt-1">
                          <MapPin className="size-3" />
                          {branch.location}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-emerald-200">Code</div>
                      <div className="font-mono font-bold">{branch.code}</div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditModal(branch)}
                      className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur rounded-lg transition-colors text-sm font-semibold"
                    >
                      <Edit2 className="size-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(branch.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 backdrop-blur rounded-lg transition-colors text-sm font-semibold"
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Users className="size-5 text-slate-600 dark:text-slate-400" />
                    <h4 className="font-semibold text-slate-900 dark:text-white">
                      Assigned Users ({branchUsers.length})
                    </h4>
                  </div>

                  <div className="space-y-2">
                    {branchUsers.length > 0 ? (
                      branchUsers.map(user => {
                        const roleConfig = roleConfigs.find(r => r.role === user.role);
                        return (
                          <div
                            key={user.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="size-8 rounded-full flex items-center justify-center font-bold text-white text-sm"
                                style={{ backgroundColor: roleConfig?.color }}
                              >
                                {user.name.split(' ').map(n => n[0]).join('')}
                              </div>
                              <div>
                                <div className="font-medium text-slate-900 dark:text-white">{user.name}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">{user.email}</div>
                              </div>
                            </div>
                            <span
                              className="px-2 py-1 rounded text-xs font-semibold text-white"
                              style={{ backgroundColor: roleConfig?.color }}
                            >
                              {user.role}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                        No users assigned to this branch
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Branch Access Matrix */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Branch Access Matrix</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Visual representation of user access across branches
            </p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-900 dark:bg-slate-950 text-white">
                  <th className="text-left p-4 font-semibold sticky left-0 bg-slate-900 dark:bg-slate-950 z-10">
                    User
                  </th>
                  {branches.map(branch => (
                    <th key={branch.id} className="text-center p-4 font-semibold min-w-[120px]">
                      <div className="flex flex-col items-center gap-1">
                        <Building2 className="size-4" />
                        <span className="text-xs">{branch.name}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((user, index) => {
                  const roleConfig = roleConfigs.find(r => r.role === user.role);
                  
                  return (
                    <tr
                      key={user.id}
                      className={index % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-800/50'}
                    >
                      <td className="p-4 border-b border-slate-200 dark:border-slate-700 sticky left-0 bg-inherit">
                        <div className="flex items-center gap-3">
                          <div
                            className="size-8 rounded-full flex items-center justify-center font-bold text-white text-sm"
                            style={{ backgroundColor: roleConfig?.color }}
                          >
                            {user.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <div className="font-medium text-slate-900 dark:text-white">{user.name}</div>
                            <span
                              className="text-xs px-2 py-0.5 rounded text-white"
                              style={{ backgroundColor: roleConfig?.color }}
                            >
                              {user.role}
                            </span>
                          </div>
                        </div>
                      </td>
                      {branches.map(branch => {
                        const hasAccess = user.branches.includes(branch.id);
                        return (
                          <td key={branch.id} className="text-center p-4 border-b border-slate-200 dark:border-slate-700">
                            {hasAccess ? (
                              <div className="inline-flex items-center justify-center size-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                                <CheckCircle2 className="size-6 text-emerald-600 dark:text-emerald-400" />
                              </div>
                            ) : (
                              <div className="inline-flex items-center justify-center size-10 rounded-lg bg-slate-100 dark:bg-slate-700">
                                <div className="size-2 rounded-full bg-slate-300 dark:bg-slate-500" />
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add/Edit Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingBranch ? 'Edit Branch' : 'Add New Branch'}
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Branch Name
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
                Branch Code
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:border-emerald-500 focus:outline-none font-mono"
                placeholder="e.g., HQ-001"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Location
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:border-emerald-500 focus:outline-none"
                required
              />
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
                Active Branch
              </label>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex-1 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors"
              >
                {editingBranch ? 'Update Branch' : 'Add Branch'}
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