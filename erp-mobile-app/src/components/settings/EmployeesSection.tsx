import { useState, useEffect, useCallback } from 'react';
import { 
  ArrowLeft, Users, Plus, DollarSign, History, 
  Briefcase, UserPlus, Loader2, ChevronRight,
  X, Edit, Shield, MapPin, Check
} from 'lucide-react';
import * as employeesApi from '../../api/employees';
import * as branchesApi from '../../api/branches';

interface EmployeesSectionProps {
  onBack: () => void;
  companyId: string;
  isAdminOrOwner: boolean;
  userId: string;
}

export function EmployeesSection({ onBack, companyId, isAdminOrOwner, userId }: EmployeesSectionProps) {
  const [employees, setEmployees] = useState<employeesApi.Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<employeesApi.Employee | null>(null);
  const [ledger, setLedger] = useState<employeesApi.EmployeeLedgerEntry[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [balance, setBalance] = useState<number>(0);
  
  // Modals
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [showAction, setShowAction] = useState<'bonus' | 'payment' | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  
  // Form states
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [newUserId, setNewUserId] = useState('');
  const [newSalary, setNewSalary] = useState('');
  const [newCommission, setNewCommission] = useState('');
  const [actionAmount, setActionAmount] = useState('');
  const [actionNote, setActionNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Edit states
  const [editSalary, setEditSalary] = useState('');
  const [editCommission, setEditCommission] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editRole, setEditRole] = useState('');
  const [editBranchIds, setEditBranchIds] = useState<string[]>([]);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    const { data, error } = await employeesApi.getEmployees(companyId);
    if (!error) setEmployees(data);
    setLoading(false);
  }, [companyId]);

  const loadAuxData = useCallback(async () => {
    const [usersRes, branchesRes] = await Promise.all([
      employeesApi.getAvailableUsers(companyId),
      branchesApi.getBranches(companyId)
    ]);
    if (!usersRes.error) setAvailableUsers(usersRes.data);
    if (!branchesRes.error) setBranches(branchesRes.data);
  }, [companyId]);

  useEffect(() => {
    loadEmployees();
    loadAuxData();
  }, [loadEmployees, loadAuxData]);

  const handleOpenLedger = async (emp: employeesApi.Employee) => {
    setSelectedEmployee(emp);
    setLoadingLedger(true);
    const [ledgerRes, balanceRes] = await Promise.all([
      employeesApi.getEmployeeLedger(emp.id),
      employeesApi.getEmployeeBalance(emp.id)
    ]);
    if (!ledgerRes.error) setLedger(ledgerRes.data);
    if (!balanceRes.error) setBalance(balanceRes.balance);
    setLoadingLedger(false);
  };

  const handleAddEmployee = async () => {
    if (!newUserId || !newSalary) return;
    setSubmitting(true);
    const { error } = await employeesApi.createEmployee(
      newUserId, 
      Number(newSalary), 
      Number(newCommission || 0),
      userId
    );
    setSubmitting(false);
    if (!error) {
      setShowAddEmployee(false);
      loadEmployees();
      setNewUserId('');
      setNewSalary('');
      setNewCommission('');
    } else {
      alert(error);
    }
  };

  const handleRecordAction = async () => {
    if (!selectedEmployee || !actionAmount || !actionNote || !showAction) return;
    setSubmitting(true);
    const type = showAction === 'bonus' ? 'bonus' : 'payment';
    const { error } = await employeesApi.addLedgerEntry(
      selectedEmployee.id,
      type,
      Number(actionAmount),
      actionNote,
      userId
    );
    setSubmitting(false);
    if (!error) {
      setShowAction(null);
      setActionAmount('');
      setActionNote('');
      handleOpenLedger(selectedEmployee);
    } else {
      alert(error);
    }
  };

  const handleOpenEdit = async (emp: employeesApi.Employee) => {
    setSelectedEmployee(emp);
    setEditSalary(emp.basic_salary.toString());
    setEditCommission(emp.commission_rate.toString());
    setEditIsActive(emp.is_active);
    
    // In mobile, we might not have a full getUser API yet, but we have user info in emp.user
    // But we need the role and branches which are not in the Employee list
    setSubmitting(true);
    const { data: branchIds } = await employeesApi.getUserBranches(emp.user_id);
    setEditBranchIds(branchIds || []);
    
    // We need to get the user role. The Employee object doesn't have it.
    // Let's assume we can get it from the users table.
    await employeesApi.getAvailableUsers(companyId);
    // This only returns available users. We need to get the role of the CURRENT employee's user.
    // I should have added a getEmployeeDetails or similar.
    // For now, I'll update getEmployees in API to include role.
    
    // Actually, I can just fetch it directly here or update getEmployees.
    // Let's use the current employee object if I update the API.
    
    setEditRole((emp.user as any)?.role || 'user');
    setSubmitting(false);
    setShowEdit(true);
  };

  const handleUpdateEmployee = async () => {
    if (!selectedEmployee) return;
    setSubmitting(true);
    
    try {
      await Promise.all([
        employeesApi.updateEmployee(selectedEmployee.id, {
          basic_salary: Number(editSalary),
          commission_rate: Number(editCommission),
          is_active: editIsActive
        }),
        employeesApi.updateUserRole(selectedEmployee.user_id, editRole),
        employeesApi.updateUserBranches(selectedEmployee.user_id, editBranchIds, companyId)
      ]);
      
      setShowEdit(false);
      loadEmployees();
      setSelectedEmployee(null);
    } catch (err: any) {
      alert(err.message || 'Update failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (selectedEmployee && !showAction && !showEdit) {
    return (
      <div className="min-h-screen bg-[#111827] pb-24">
        <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
          <div className="flex items-center justify-between px-4 h-14">
            <div className="flex items-center gap-3">
              <button onClick={() => setSelectedEmployee(null)} className="p-2 hover:bg-[#374151] rounded-lg text-white">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-white font-semibold text-base">Employee Ledger</h1>
            </div>
            {isAdminOrOwner && (
              <button 
                onClick={() => handleOpenEdit(selectedEmployee)}
                className="p-2 bg-[#3B82F6]/10 text-[#3B82F6] rounded-lg"
              >
                <Edit className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <p className="text-xs text-[#9CA3AF] mb-1">Employee</p>
            <p className="font-medium text-white text-lg">{selectedEmployee.user?.full_name || selectedEmployee.user?.name}</p>
            <p className="text-sm text-[#6B7280]">{selectedEmployee.user?.email}</p>
            <div className="mt-4 grid grid-cols-2 gap-4">
               <div className="bg-[#111827] p-3 rounded-lg border border-[#374151] col-span-2">
                  <p className="text-[10px] text-[#9CA3AF] uppercase font-bold mb-1">Current Balance</p>
                  <p className={`text-xl font-bold ${balance >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                    Rs. {balance.toLocaleString()}
                  </p>
               </div>
               <div className="bg-[#111827] p-3 rounded-lg border border-[#374151]">
                  <p className="text-[10px] text-[#9CA3AF] uppercase font-bold mb-1">Basic Salary</p>
                  <p className="text-white font-semibold">Rs. {Number(selectedEmployee.basic_salary).toLocaleString()}</p>
               </div>
               <div className="bg-[#111827] p-3 rounded-lg border border-[#374151]">
                  <p className="text-[10px] text-[#9CA3AF] uppercase font-bold mb-1">Commission</p>
                  <p className="text-white font-semibold">{selectedEmployee.commission_rate}%</p>
               </div>
            </div>
          </div>

          <div className="flex gap-2">
            {isAdminOrOwner && (
              <>
                <button 
                  onClick={() => setShowAction('bonus')}
                  className="flex-1 bg-[#8B5CF6] text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2"
                >
                  <Plus size={18} /> Bonus
                </button>
                <button 
                  onClick={() => setShowAction('payment')}
                  className="flex-1 bg-[#10B981] text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2"
                >
                  <DollarSign size={18} /> Pay
                </button>
              </>
            )}
          </div>

          <div className="bg-[#1F2937] border border-[#374151] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#374151] flex items-center justify-between">
              <h3 className="text-sm font-medium text-white">Transaction History</h3>
              <History size={16} className="text-[#9CA3AF]" />
            </div>
            <div className="divide-y divide-[#374151]">
              {loadingLedger ? (
                <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-[#3B82F6]" /></div>
              ) : ledger.length === 0 ? (
                <div className="p-8 text-center text-[#6B7280] text-sm">No transactions yet</div>
              ) : (
                ledger.map(entry => (
                  <div key={entry.id} className="p-4 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-white text-sm font-medium">{entry.description}</span>
                      <span className="text-[10px] text-[#6B7280] mt-0.5 capitalize">
                        {new Date(entry.created_at).toLocaleDateString()} • {entry.type}
                      </span>
                    </div>
                    <div className={`text-sm font-bold ${['salary', 'bonus', 'commission'].includes(entry.type) ? 'text-[#3B82F6]' : 'text-[#EF4444]'}`}>
                      {['salary', 'bonus', 'commission'].includes(entry.type) ? '+' : '-'} {Number(entry.amount).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 bg-[#3B82F6]/20 rounded-lg flex items-center justify-center">
              <Briefcase size={18} className="text-[#3B82F6]" />
            </div>
            <h1 className="text-white font-semibold text-base">Employee Management</h1>
          </div>
          {isAdminOrOwner && (
            <button 
              onClick={async () => {
                const { data } = await employeesApi.getAvailableUsers(companyId);
                setAvailableUsers(data);
                setShowAddEmployee(true);
              }}
              className="p-2 bg-[#3B82F6] text-white rounded-lg"
            >
              <UserPlus size={20} />
            </button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[#3B82F6] w-8 h-8" /></div>
        ) : employees.length === 0 ? (
          <div className="text-center py-12 bg-[#1F2937] border border-[#374151] rounded-xl">
            <Users className="w-12 h-12 text-[#374151] mx-auto mb-3" />
            <p className="text-[#9CA3AF]">No employees registered yet</p>
          </div>
        ) : (
          employees.map(emp => (
            <button 
              key={emp.id}
              onClick={() => handleOpenLedger(emp)}
              className="w-full bg-[#1F2937] border border-[#374151] rounded-xl p-4 flex items-center justify-between text-left hover:border-[#3B82F6] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#3B82F6]/10 rounded-full flex items-center justify-center text-[#3B82F6] font-bold">
                  {(emp.user?.full_name || emp.user?.name || 'E').charAt(0)}
                </div>
                <div>
                  <p className="font-medium text-white">{emp.user?.full_name || emp.user?.name}</p>
                  <p className="text-xs text-[#6B7280]">Rs. {Number(emp.basic_salary).toLocaleString()} / month</p>
                </div>
              </div>
              <ChevronRight size={20} className="text-[#374151]" />
            </button>
          ))
        )}
      </div>

      {/* Edit Employee Overlay */}
      {showEdit && selectedEmployee && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#1F2937] w-full max-w-md rounded-2xl p-6 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">Edit Employee</h2>
              <button onClick={() => setShowEdit(false)} className="text-[#9CA3AF]"><X /></button>
            </div>
            
            <div className="space-y-6">
              {/* Payroll Section */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-[#3B82F6] uppercase tracking-wider flex items-center gap-2">
                  <DollarSign className="w-3.5 h-3.5" /> Payroll
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-[#9CA3AF] block mb-1 uppercase font-bold">Salary (Rs.)</label>
                    <input 
                      type="number" 
                      className="w-full bg-[#111827] border border-[#374151] rounded-xl px-4 py-2.5 text-white outline-none text-sm"
                      value={editSalary}
                      onChange={(e) => setEditSalary(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#9CA3AF] block mb-1 uppercase font-bold">Comm. (%)</label>
                    <input 
                      type="number" 
                      className="w-full bg-[#111827] border border-[#374151] rounded-xl px-4 py-2.5 text-white outline-none text-sm"
                      value={editCommission}
                      onChange={(e) => setEditCommission(e.target.value)}
                    />
                  </div>
                </div>
                <button 
                  onClick={() => setEditIsActive(!editIsActive)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border transition-colors ${editIsActive ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-gray-500/10 border-gray-500/20 text-gray-400'}`}
                >
                  <span className="text-sm font-medium">Employee Active</span>
                  <div className={`w-10 h-5 rounded-full relative transition-colors ${editIsActive ? 'bg-green-500' : 'bg-gray-600'}`}>
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${editIsActive ? 'right-1' : 'left-1'}`} />
                  </div>
                </button>
              </div>

              {/* Role Section */}
              <div className="space-y-4 pt-2 border-t border-[#374151]">
                <h3 className="text-xs font-bold text-[#A78BFA] uppercase tracking-wider flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5" /> Role & Permissions
                </h3>
                <div>
                  <label className="text-[10px] text-[#9CA3AF] block mb-1.5 uppercase font-bold">User Role</label>
                  <select 
                    className="w-full bg-[#111827] border border-[#374151] rounded-xl px-4 py-2.5 text-white outline-none text-sm"
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                  >
                    <option value="owner">Owner</option>
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="user">User / Staff</option>
                  </select>
                </div>
              </div>

              {/* Branches Section */}
              <div className="space-y-4 pt-2 border-t border-[#374151]">
                <h3 className="text-xs font-bold text-[#F59E0B] uppercase tracking-wider flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5" /> Branch Access
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {branches.map(branch => {
                    const isSelected = editBranchIds.includes(branch.id);
                    return (
                      <button
                        key={branch.id}
                        onClick={() => {
                          if (isSelected) setEditBranchIds(editBranchIds.filter(id => id !== branch.id));
                          else setEditBranchIds([...editBranchIds, branch.id]);
                        }}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-xs text-left transition-colors ${isSelected ? 'bg-[#3B82F6]/10 border-[#3B82F6]/30 text-[#3B82F6]' : 'bg-[#111827] border-[#374151] text-[#9CA3AF]'}`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-[#3B82F6] border-[#3B82F6]' : 'border-[#374151]'}`}>
                          {isSelected && <Check size={10} className="text-white" />}
                        </div>
                        <span className="truncate">{branch.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button 
                onClick={handleUpdateEmployee}
                disabled={submitting}
                className="w-full bg-[#3B82F6] hover:bg-[#2563EB] disabled:bg-[#3B82F6]/50 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 mt-4"
              >
                {submitting ? <Loader2 size={18} className="animate-spin" /> : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Employee Modal/Overlay */}
      {showAddEmployee && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#1F2937] w-full max-w-md rounded-2xl p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">Add Employee</h2>
              <button onClick={() => setShowAddEmployee(false)} className="text-[#9CA3AF]"><X /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-[#9CA3AF] block mb-1.5 uppercase font-bold">Select User</label>
                <select 
                  className="w-full bg-[#111827] border border-[#374151] rounded-xl px-4 py-3 text-white focus:border-[#3B82F6] outline-none"
                  value={newUserId}
                  onChange={(e) => setNewUserId(e.target.value)}
                >
                  <option value="">Select a user...</option>
                  {availableUsers.map(u => <option key={u.id} value={u.id}>{u.full_name || u.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-[#9CA3AF] block mb-1.5 uppercase font-bold">Salary (Rs.)</label>
                  <input 
                    type="number" 
                    className="w-full bg-[#111827] border border-[#374151] rounded-xl px-4 py-3 text-white outline-none"
                    value={newSalary}
                    onChange={(e) => setNewSalary(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-[#9CA3AF] block mb-1.5 uppercase font-bold">Comm. (%)</label>
                  <input 
                    type="number" 
                    className="w-full bg-[#111827] border border-[#374151] rounded-xl px-4 py-3 text-white outline-none"
                    value={newCommission}
                    onChange={(e) => setNewCommission(e.target.value)}
                  />
                </div>
              </div>
              <button 
                disabled={submitting}
                onClick={handleAddEmployee}
                className="w-full bg-[#3B82F6] text-white py-4 rounded-xl font-bold mt-4 flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="animate-spin" /> : 'Confirm Registration'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bonus/Payment Modal */}
      {showAction && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#1F2937] w-full max-w-md rounded-2xl p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white capitalize">Record {showAction}</h2>
              <button onClick={() => setShowAction(null)} className="text-[#9CA3AF]"><X /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-[#9CA3AF] block mb-1.5 uppercase font-bold">Amount (Rs.)</label>
                <input 
                  type="number" 
                  autoFocus
                  className="w-full bg-[#111827] border border-[#374151] rounded-xl px-4 py-3 text-white outline-none"
                  value={actionAmount}
                  onChange={(e) => setActionAmount(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-[#9CA3AF] block mb-1.5 uppercase font-bold">Notes / Description</label>
                <input 
                  type="text" 
                  className="w-full bg-[#111827] border border-[#374151] rounded-xl px-4 py-3 text-white outline-none"
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                  placeholder={`Reason for ${showAction}...`}
                />
              </div>
              <button 
                disabled={submitting}
                onClick={handleRecordAction}
                className={`w-full ${showAction === 'bonus' ? 'bg-[#8B5CF6]' : 'bg-[#10B981]'} text-white py-4 rounded-xl font-bold mt-4 flex items-center justify-center gap-2`}
              >
                {submitting ? <Loader2 className="animate-spin" /> : `Record ${showAction}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
