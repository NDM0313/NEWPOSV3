import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, Plus, DollarSign, History, TrendingUp, 
  Search, Filter, MoreVertical, CheckCircle, AlertCircle,
  Briefcase, Wallet, ArrowUpRight, ArrowDownRight, UserPlus, RefreshCw,
  Edit, Shield, MapPin, Save
} from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Checkbox } from "../ui/checkbox";
import { 
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell 
} from "../ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "../ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../ui/select";
import { employeeService, Employee, EmployeeLedgerEntry } from '@/app/services/employeeService';
import { userService, User } from '@/app/services/userService';
import { branchService, Branch } from '@/app/services/branchService';
import { useSupabase } from '@/app/context/SupabaseContext';
import { toast } from 'sonner';
import { cn } from "../ui/utils";
import { Switch } from "../ui/switch";

export const EmployeesTab = () => {
  const { companyId, userRole } = useSupabase();
  const isAdminOrOwner = (() => {
    if (!userRole) return false;
    const r = userRole.toLowerCase().trim();
    return r === 'admin' || r === 'owner' || r === 'super admin' || r === 'superadmin';
  })();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [addEmployeeModalOpen, setAddEmployeeModalOpen] = useState(false);
  const [ledgerModalOpen, setLedgerModalOpen] = useState(false);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  
  // Selection
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedLedger, setSelectedLedger] = useState<EmployeeLedgerEntry[]>([]);
  const [selectedBalance, setSelectedBalance] = useState(0);

  // Form states
  const [actionType, setActionType] = useState<'bonus' | 'payment' | 'adjustment'>('bonus');
  const [actionAmount, setActionAmount] = useState('');
  const [actionDescription, setActionDescription] = useState('');
  const [newEmployeeUserId, setNewEmployeeUserId] = useState('');
  const [newEmployeeSalary, setNewEmployeeSalary] = useState('');
  const [newEmployeeCommission, setNewEmployeeCommission] = useState('');

  // Edit states
  const [editSalary, setEditSalary] = useState('');
  const [editCommission, setEditCommission] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editRole, setEditRole] = useState('');
  const [editBranches, setEditBranches] = useState<string[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [empData, availUsers, branchList] = await Promise.all([
        employeeService.getAllEmployees(),
        employeeService.getAvailableUsers(companyId),
        branchService.getAllBranches(companyId)
      ]);
      setEmployees(empData);
      setAvailableUsers(availUsers);
      setBranches(branchList);
    } catch (error) {
      console.error('Error loading employees:', error);
      toast.error('Failed to load employee data');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddEmployee = async () => {
    if (!newEmployeeUserId || !newEmployeeSalary) {
      toast.error('Please fill required fields');
      return;
    }
    try {
      const res = await employeeService.createEmployee(
        newEmployeeUserId, 
        Number(newEmployeeSalary), 
        Number(newEmployeeCommission || 0)
      );
      if (res) {
        toast.success('Employee added successfully');
        setAddEmployeeModalOpen(false);
        loadData();
        // Reset form
        setNewEmployeeUserId('');
        setNewEmployeeSalary('');
        setNewEmployeeCommission('');
      } else {
        toast.error('Failed to add employee');
      }
    } catch (error) {
      toast.error('An error occurred');
    }
  };

  const handleAction = async () => {
    if (!selectedEmployee || !actionAmount || !actionDescription) {
      toast.error('Please fill required fields');
      return;
    }
    try {
      let res;
      if (actionType === 'bonus') {
        res = await employeeService.addLedgerEntry(selectedEmployee.id, 'bonus', Number(actionAmount), actionDescription);
      } else if (actionType === 'payment') {
        res = await employeeService.payEmployee(selectedEmployee.id, Number(actionAmount), actionDescription);
      } else {
        res = await employeeService.addLedgerEntry(selectedEmployee.id, 'adjustment', Number(actionAmount), actionDescription);
      }

      if (res) {
        toast.success(`${actionType.charAt(0).toUpperCase() + actionType.slice(1)} recorded`);
        setActionModalOpen(false);
        loadData();
        // Reset form
        setActionAmount('');
        setActionDescription('');
      } else {
        toast.error('Failed to record action');
      }
    } catch (error) {
      toast.error('An error occurred');
    }
  };

  const openLedger = async (employee: Employee) => {
    setSelectedEmployee(employee);
    setLedgerModalOpen(true);
    try {
      const [ledger, balance] = await Promise.all([
        employeeService.getEmployeeLedger(employee.id),
        employeeService.getEmployeeBalance(employee.id)
      ]);
      setSelectedLedger(ledger);
      setSelectedBalance(balance);
    } catch (error) {
      console.error('Error loading ledger:', error);
    }
  };

  const openAction = (employee: Employee, type: 'bonus' | 'payment' | 'adjustment') => {
    setSelectedEmployee(employee);
    setActionType(type);
    setActionModalOpen(true);
  };

  const openEdit = async (employee: Employee) => {
    setSelectedEmployee(employee);
    setEditSalary(employee.basic_salary.toString());
    setEditCommission(employee.commission_rate.toString());
    setEditIsActive(employee.is_active);
    
    // Fetch user details for role and branches
    try {
      const [user, userBranches] = await Promise.all([
        userService.getUser(employee.user_id),
        userService.getUserBranches(employee.user_id)
      ]);
      setEditRole(user.role || 'user');
      setEditBranches(userBranches.map((b: any) => b.branch_id));
    } catch (error) {
      console.error('Error fetching user details:', error);
    }
    
    setEditModalOpen(true);
  };

  const handleUpdateEmployee = async () => {
    if (!selectedEmployee || !companyId) return;
    setSavingEdit(true);
    try {
      // 1. Update Employee Record
      await employeeService.updateEmployee(selectedEmployee.id, {
        basic_salary: Number(editSalary),
        commission_rate: Number(editCommission),
        is_active: editIsActive
      });

      // 2. Update User Role
      await userService.updateUser(selectedEmployee.user_id, { role: editRole });

      // 3. Update User Branches
      await userService.setUserBranches(selectedEmployee.user_id, editBranches, editBranches[0] || null, companyId);

      toast.success('Employee updated successfully');
      setEditModalOpen(false);
      loadData();
    } catch (error) {
      console.error('Error updating employee:', error);
      toast.error('Failed to update employee');
    } finally {
      setSavingEdit(false);
    }
  };

  const filteredEmployees = employees.filter(emp => 
    (emp.user?.full_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (emp.user?.email?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-900/50 border border-gray-800 p-4 rounded-xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <span className="text-gray-400 text-sm">Total Employees</span>
          </div>
          <div className="text-2xl font-bold text-white">{employees.length}</div>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 p-4 rounded-xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <span className="text-gray-400 text-sm">Active Payroll</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {employees.filter(e => e.is_active).length}
          </div>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 p-4 rounded-xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Briefcase className="w-5 h-5 text-purple-500" />
            </div>
            <span className="text-gray-400 text-sm">Total Monthly Salary</span>
          </div>
          <div className="text-2xl font-bold text-white">
            Rs. {employees.reduce((acc, e) => acc + (e.is_active ? Number(e.basic_salary) : 0), 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input 
            placeholder="Search employees..." 
            className="pl-10 bg-gray-900 border-gray-800 text-white"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          {isAdminOrOwner && (
            <>
              <Button 
                variant="outline" 
                className="flex-1 md:flex-none border-gray-800 text-gray-300 hover:bg-gray-800"
                onClick={async () => {
                  const confirm = window.confirm('Run monthly salary credit for all active employees?');
                  if (confirm && companyId) {
                    const res = await employeeService.runMonthlySalaryCredit(companyId);
                    if (res.success) {
                      toast.success(`Processed salary for ${res.processed} employees`);
                      loadData();
                    }
                  }
                }}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Run Payroll
              </Button>
              <Button 
                className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => setAddEmployeeModalOpen(true)}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Add Employee
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Employee Table */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-800/50">
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Basic Salary</TableHead>
              <TableHead>Commission</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-gray-500">Loading employees...</TableCell>
              </TableRow>
            ) : filteredEmployees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-gray-500">No employees found</TableCell>
              </TableRow>
            ) : (
              filteredEmployees.map((emp) => (
                <TableRow key={emp.id} className="hover:bg-gray-800/30">
                  <TableCell>
                    <div>
                      <div className="font-medium text-white">{emp.user?.full_name}</div>
                      <div className="text-xs text-gray-500">{emp.user?.email}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-white">Rs. {Number(emp.basic_salary).toLocaleString()}</TableCell>
                  <TableCell className="text-white">{emp.commission_rate}%</TableCell>
                  <TableCell>
                    <Badge className={emp.is_active ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-gray-500/10 text-gray-500 border-gray-500/20"}>
                      {emp.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openLedger(emp)} className="text-gray-400 hover:text-white" title="View Ledger">
                        <History className="w-4 h-4" />
                      </Button>
                      {isAdminOrOwner && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(emp)} className="text-blue-400 hover:text-blue-300" title="Edit Employee">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openAction(emp, 'bonus')} className="text-purple-400 hover:text-purple-300">
                            <Plus className="w-4 h-4 mr-1" /> Bonus
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openAction(emp, 'payment')} className="text-green-400 hover:text-green-300">
                            <DollarSign className="w-4 h-4 mr-1" /> Pay
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Employee Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Employee: {selectedEmployee?.user?.full_name}</DialogTitle>
            <DialogDescription className="text-gray-400">
              Update payroll details, role, and branch access.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            {/* Payroll Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                <DollarSign className="w-4 h-4" /> Payroll Details
              </h3>
              <div className="space-y-2">
                <Label>Basic Salary (Rs.)</Label>
                <Input 
                  type="number" 
                  value={editSalary} 
                  onChange={(e) => setEditSalary(e.target.value)}
                  className="bg-gray-800 border-gray-700"
                />
              </div>
              <div className="space-y-2">
                <Label>Commission Rate (%)</Label>
                <Input 
                  type="number" 
                  value={editCommission} 
                  onChange={(e) => setEditCommission(e.target.value)}
                  className="bg-gray-800 border-gray-700"
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Active Status</Label>
                  <p className="text-xs text-gray-500">Employee can receive salary/commission</p>
                </div>
                <Switch 
                  checked={editIsActive} 
                  onCheckedChange={setEditIsActive}
                />
              </div>
            </div>

            {/* Access Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-2">
                <Shield className="w-4 h-4" /> Role & Access
              </h3>
              <div className="space-y-2">
                <Label>User Role</Label>
                <Select value={editRole} onValueChange={setEditRole}>
                  <SelectTrigger className="bg-gray-800 border-gray-700">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="user">User / Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4" /> Branch Access
                </Label>
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                  {branches.map((branch) => (
                    <div key={branch.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`branch-${branch.id}`}
                        checked={editBranches.includes(branch.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setEditBranches([...editBranches, branch.id]);
                          } else {
                            setEditBranches(editBranches.filter(id => id !== branch.id));
                          }
                        }}
                      />
                      <label 
                        htmlFor={`branch-${branch.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {branch.name}
                      </label>
                    </div>
                  ))}
                  {branches.length === 0 && (
                    <div className="text-xs text-gray-500 text-center py-2">No branches found</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)} className="border-gray-800 text-gray-400">
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateEmployee} 
              disabled={savingEdit}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {savingEdit ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Employee Modal */}
      <Dialog open={addEmployeeModalOpen} onOpenChange={setAddEmployeeModalOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle>Add New Employee</DialogTitle>
            <DialogDescription className="text-gray-400">
              Select a user to register as an employee.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select User</Label>
              <Select value={newEmployeeUserId} onValueChange={setNewEmployeeUserId}>
                <SelectTrigger className="bg-gray-800 border-gray-700">
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 text-white">
                  {availableUsers.map(u => (
                    <SelectItem key={u.id} value={u.id}>{(u as any).full_name ?? (u as any).name} ({u.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Basic Salary (Rs.)</Label>
                <Input 
                  type="number" 
                  className="bg-gray-800 border-gray-700" 
                  value={newEmployeeSalary}
                  onChange={(e) => setNewEmployeeSalary(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Commission Rate (%)</Label>
                <Input 
                  type="number" 
                  className="bg-gray-800 border-gray-700" 
                  value={newEmployeeCommission}
                  onChange={(e) => setNewEmployeeCommission(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddEmployeeModalOpen(false)} className="border-gray-800 text-gray-300">Cancel</Button>
            <Button onClick={handleAddEmployee} className="bg-blue-600 hover:bg-blue-700">Add Employee</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ledger Modal */}
      <Dialog open={ledgerModalOpen} onOpenChange={setLedgerModalOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle>Employee Ledger: {selectedEmployee?.user?.full_name}</DialogTitle>
            <div className="mt-2 flex items-center gap-4">
              <div className="bg-gray-800 px-3 py-1 rounded-lg border border-gray-700">
                <span className="text-gray-400 text-xs uppercase mr-2 font-semibold">Current Balance</span>
                <span className={cn("font-bold", selectedBalance >= 0 ? "text-green-500" : "text-red-500")}>
                  Rs. {selectedBalance.toLocaleString()}
                </span>
              </div>
            </div>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto pr-2 mt-4">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800">
                  <TableHead className="text-gray-400">Date</TableHead>
                  <TableHead className="text-gray-400">Type</TableHead>
                  <TableHead className="text-gray-400">Description</TableHead>
                  <TableHead className="text-right text-gray-400">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedLedger.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-gray-500">No transactions recorded</TableCell>
                  </TableRow>
                ) : (
                  selectedLedger.map((entry) => (
                    <TableRow key={entry.id} className="border-gray-800/50">
                      <TableCell className="text-xs text-gray-300">
                        {new Date(entry.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("text-[10px] uppercase font-bold", 
                          entry.type === 'payment' ? "bg-red-500/10 text-red-500 border-red-500/20" : 
                          entry.type === 'salary' ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                          entry.type === 'bonus' ? "bg-purple-500/10 text-purple-500 border-purple-500/20" :
                          "bg-green-500/10 text-green-500 border-green-500/20"
                        )}>
                          {entry.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-gray-400 max-w-[200px] truncate">
                        {entry.description}
                      </TableCell>
                      <TableCell className={cn("text-right font-medium", 
                        ['salary', 'bonus', 'commission'].includes(entry.type) ? "text-blue-400" : 
                        entry.type === 'payment' ? "text-red-400" : "text-gray-300"
                      )}>
                        {['salary', 'bonus', 'commission'].includes(entry.type) ? '+' : '-'} Rs. {Number(entry.amount).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button onClick={() => setLedgerModalOpen(false)} className="bg-gray-800 border-gray-700 text-white">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bonus / Payment / Adjustment Modal */}
      <Dialog open={actionModalOpen} onOpenChange={setActionModalOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle>Record {actionType.charAt(0).toUpperCase() + actionType.slice(1)}</DialogTitle>
            <DialogDescription className="text-gray-400">
              Recording for {selectedEmployee?.user?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Amount (Rs.)</Label>
              <Input 
                type="number" 
                className="bg-gray-800 border-gray-700" 
                value={actionAmount}
                onChange={(e) => setActionAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input 
                className="bg-gray-800 border-gray-700" 
                value={actionDescription}
                onChange={(e) => setActionDescription(e.target.value)}
                placeholder="Reason for this entry..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionModalOpen(false)} className="border-gray-800 text-gray-300">Cancel</Button>
            <Button onClick={handleAction} className={cn(
              actionType === 'payment' ? "bg-green-600 hover:bg-green-700" : "bg-purple-600 hover:bg-purple-700"
            )}>
              Confirm {actionType.charAt(0).toUpperCase() + actionType.slice(1)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
