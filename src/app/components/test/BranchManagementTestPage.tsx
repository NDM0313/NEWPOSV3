import React, { useState, useEffect, useCallback } from 'react';
import { 
  MapPin, 
  Plus, 
  Edit, 
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useSupabase } from '../../context/SupabaseContext';
import { branchService, Branch } from '../../services/branchService';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { AddBranchModal } from '../branches/AddBranchModal';

export const BranchManagementTestPage = () => {
  const { companyId } = useSupabase();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [addBranchModalOpen, setAddBranchModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);

  // Load branches
  const loadBranches = useCallback(async () => {
    if (!companyId) return;
    
    setLoading(true);
    try {
      const branchesData = await branchService.getAllBranches(companyId);
      setBranches(branchesData);
    } catch (error) {
      console.error('[BRANCH MANAGEMENT TEST] Error loading branches:', error);
      toast.error('Failed to load branches');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  // Load branches on mount
  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  // Open modal for new branch
  const handleAddBranch = () => {
    setEditingBranch(null);
    setAddBranchModalOpen(true);
  };

  // Open modal for edit
  const handleEditBranch = (branch: Branch) => {
    setEditingBranch(branch);
    setAddBranchModalOpen(true);
  };

  // Toggle branch active status
  const handleToggleActive = async (branch: Branch) => {
    try {
      await branchService.updateBranch(branch.id, { is_active: !branch.is_active });
      toast.success(`Branch ${branch.is_active ? 'deactivated' : 'activated'}`);
      await loadBranches();
    } catch (error: any) {
      toast.error(`Failed to update branch: ${error.message}`);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0B0F17] text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-[#111827] px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Branch Management Test</h1>
            <p className="text-sm text-gray-400 mt-1">Test page for branch management functionality</p>
          </div>
          <Button 
            onClick={handleAddBranch}
            className="bg-blue-600 hover:bg-blue-500"
          >
            <Plus size={16} className="mr-2" /> Add Branch
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading branches...</div>
          ) : branches.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <MapPin size={48} className="mx-auto mb-4 text-gray-600" />
              <p className="mb-2">No branches found</p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleAddBranch}
              >
                Create First Branch
              </Button>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-950 border-b border-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Location</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Phone</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {branches.map((branch) => (
                  <tr key={branch.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                          <MapPin size={16} className="text-green-400" />
                        </div>
                        <div>
                          <span className="text-white text-sm font-medium">{branch.name}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-300 text-sm">{branch.code || '-'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-300 text-sm">
                        {branch.address && <div>{branch.address}</div>}
                        {(branch.city || branch.state) && (
                          <div className="text-xs text-gray-500">
                            {[branch.city, branch.state].filter(Boolean).join(', ')}
                          </div>
                        )}
                        {!branch.address && !branch.city && !branch.state && (
                          <span className="text-gray-500">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-300 text-sm">{branch.phone || '-'}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge className={cn(
                        "text-xs font-medium",
                        branch.is_active 
                          ? "bg-green-500/20 text-green-400 border-green-500/30" 
                          : "bg-gray-500/20 text-gray-400 border-gray-500/30"
                      )}>
                        {branch.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditBranch(branch)}
                          className="text-xs h-7"
                        >
                          <Edit size={14} className="mr-1" /> Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(branch)}
                          className="text-xs h-7"
                        >
                          {branch.is_active ? 'Deactivate' : 'Activate'}
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

      {/* Add Branch Modal - Centered Dialog */}
      <AddBranchModal
        open={addBranchModalOpen}
        onClose={() => {
          setAddBranchModalOpen(false);
          setEditingBranch(null);
        }}
        onSuccess={() => {
          loadBranches();
        }}
        editingBranch={editingBranch}
      />
    </div>
  );
};
