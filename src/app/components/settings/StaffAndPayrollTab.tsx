import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  DollarSign,
  RefreshCw,
  Save,
  Settings2,
  UserCog,
  Users,
  Info,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../ui/dialog';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { payrollSettingsService } from '@/app/services/payrollSettingsService';
import { userService, type User } from '@/app/services/userService';
import { branchService, type Branch } from '@/app/services/branchService';
import { accountService } from '@/app/services/accountService';
import {
  DEFAULT_PAYROLL_SETTINGS,
  type DefaultPayrollSettings,
  type SalarySettingsRow,
} from '@/app/types/payrollSettings';
import {
  formatGenerationDayHint,
  resolvePayrollGenerationDayForMonth,
} from '@/app/lib/payrollGenerationDate';
import { toast } from 'sonner';
import { EmployeesTab } from './EmployeesTab';

const NONE = '__none__';

export function StaffAndPayrollTab() {
  const { companyId, userRole } = useSupabase();
  const { formatCurrency } = useFormatCurrency();
  const isAdminOrOwner = useMemo(() => {
    if (!userRole) return false;
    const r = userRole.toLowerCase().trim();
    return r === 'admin' || r === 'owner' || r === 'super admin' || r === 'superadmin';
  }, [userRole]);

  const [loading, setLoading] = useState(true);
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [defaults, setDefaults] = useState<DefaultPayrollSettings>(DEFAULT_PAYROLL_SETTINGS);
  const [staffRows, setStaffRows] = useState<SalarySettingsRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<
    { id: string; name: string; code?: string }[]
  >([]);
  const [companyUsers, setCompanyUsers] = useState<User[]>([]);
  const [backfillResult, setBackfillResult] = useState<number | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<SalarySettingsRow | null>(null);
  const [editForm, setEditForm] = useState({
    salary_enabled: true,
    basic_monthly_salary: '0',
    generation_day: '',
    branch_id: NONE,
    default_payment_account_id: NONE,
    commission_enabled: true,
    advance_allowed: false,
    notes: '',
    is_active: true,
  });
  const [savingStaff, setSavingStaff] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [addUserId, setAddUserId] = useState('');

  const now = new Date();
  const previewMonth = now.getMonth() + 1;
  const previewYear = now.getFullYear();
  const effectiveDayThisMonth = resolvePayrollGenerationDayForMonth(
    previewYear,
    previewMonth,
    defaults.generationDay,
  );

  const loadAll = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [def, rows, branchList, accts, users] = await Promise.all([
        payrollSettingsService.getDefaultPayrollSettings(companyId),
        payrollSettingsService.listSalarySettings(companyId),
        branchService.getAllBranches(companyId),
        accountService.getAccountsForBranchDefaults(companyId),
        userService.getUsersForSalary(companyId),
      ]);
      setDefaults(def);
      setStaffRows(rows);
      setBranches(branchList);
      setPaymentAccounts(
        (Array.isArray(accts) ? accts : []).map((a: { id: string; name: string; code?: string }) => ({
          id: a.id,
          name: a.name,
          code: a.code,
        })),
      );
      setCompanyUsers(users);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load payroll settings');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const usersWithoutSettings = useMemo(() => {
    const have = new Set(staffRows.map((r) => r.user_id));
    return companyUsers.filter((u) => !have.has(u.id));
  }, [companyUsers, staffRows]);

  const handleSaveDefaults = async () => {
    if (!companyId) return;
    setSavingDefaults(true);
    try {
      const saved = await payrollSettingsService.saveDefaultPayrollSettings(companyId, defaults);
      setDefaults(saved);
      toast.success('Default payroll settings saved');
    } catch (err) {
      console.error(err);
      toast.error('Could not save default settings');
    } finally {
      setSavingDefaults(false);
    }
  };

  const handleBackfill = async () => {
    if (!companyId) return;
    try {
      const res = await payrollSettingsService.backfillFromEmployees(companyId);
      setBackfillResult(res.inserted);
      toast.success(
        res.inserted > 0
          ? `Backfilled ${res.inserted} staff salary setting(s) from employees`
          : 'No new rows — all employees already have salary settings',
      );
      await loadAll();
    } catch (err) {
      console.error(err);
      toast.error('Backfill failed');
    }
  };

  const openEdit = (row: SalarySettingsRow) => {
    setEditRow(row);
    setEditForm({
      salary_enabled: row.salary_enabled,
      basic_monthly_salary: String(row.basic_monthly_salary ?? 0),
      generation_day: row.generation_day != null ? String(row.generation_day) : '',
      branch_id: row.branch_id ?? NONE,
      default_payment_account_id: row.default_payment_account_id ?? NONE,
      commission_enabled: row.commission_enabled,
      advance_allowed: row.advance_allowed,
      notes: row.notes ?? '',
      is_active: row.is_active,
    });
    setEditOpen(true);
  };

  const handleSaveStaff = async () => {
    if (!companyId || !editRow) return;
    setSavingStaff(true);
    try {
      await payrollSettingsService.upsertSalarySettings(companyId, {
        user_id: editRow.user_id,
        salary_enabled: editForm.salary_enabled,
        basic_monthly_salary: Number(editForm.basic_monthly_salary) || 0,
        generation_day:
          editForm.generation_day.trim() === ''
            ? null
            : Math.min(31, Math.max(1, Number(editForm.generation_day))),
        branch_id: editForm.branch_id === NONE ? null : editForm.branch_id,
        default_payment_account_id:
          editForm.default_payment_account_id === NONE
            ? null
            : editForm.default_payment_account_id,
        commission_enabled: editForm.commission_enabled,
        advance_allowed: editForm.advance_allowed,
        notes: editForm.notes.trim() || null,
        is_active: editForm.is_active,
      });
      toast.success('Staff salary settings saved');
      setEditOpen(false);
      await loadAll();
    } catch (err) {
      console.error(err);
      toast.error('Could not save staff settings');
    } finally {
      setSavingStaff(false);
    }
  };

  const handleAddStaff = async () => {
    if (!companyId || !addUserId) return;
    try {
      await payrollSettingsService.ensureForUser(companyId, addUserId);
      toast.success('Staff added to salary settings');
      setAddOpen(false);
      setAddUserId('');
      await loadAll();
    } catch (err) {
      console.error(err);
      toast.error('Could not add staff');
    }
  };

  if (!isAdminOrOwner) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 text-amber-200">
        Only admin or owner can manage staff and payroll settings.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 flex gap-3 text-sm text-blue-100">
        <Info className="w-5 h-5 shrink-0 text-blue-400 mt-0.5" />
        <div>
          <p className="font-medium text-blue-200">Phase 1 — Settings only</p>
          <p className="text-blue-100/80 mt-1">
            Configure salary and commission eligibility here. Payroll runs, GL posting, and salary
            payments are <strong>not</strong> enabled yet (Phase 2+). Commission amounts continue
            to come from the existing sales commission engine — nothing is reposted from this screen.
          </p>
        </div>
      </div>

      {/* Global defaults */}
      <section className="bg-card border border-border rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-foreground">Default Payroll Settings</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-muted-foreground">Salary generation day (monthly)</Label>
            <Input
              type="number"
              min={1}
              max={31}
              value={defaults.generationDay}
              onChange={(e) =>
                setDefaults((d) => ({
                  ...d,
                  generationDay: Number(e.target.value) || 30,
                }))
              }
              className="bg-muted border-border text-foreground max-w-[120px]"
            />
            <p className="text-xs text-muted-foreground">{formatGenerationDayHint(defaults.generationDay)}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-2">
              <Calendar className="w-3.5 h-3.5" />
              This month ({previewYear}-{String(previewMonth).padStart(2, '0')}): prepares on day{' '}
              <span className="font-semibold text-foreground">{effectiveDayThisMonth}</span>
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground">Default payment account</Label>
            <Select
              value={defaults.defaultPaymentAccountId ?? NONE}
              onValueChange={(v) =>
                setDefaults((d) => ({
                  ...d,
                  defaultPaymentAccountId: v === NONE ? null : v,
                }))
              }
            >
              <SelectTrigger className="bg-muted border-border text-foreground">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent className="bg-muted border-border text-foreground">
                <SelectItem value={NONE}>— Company default (unset) —</SelectItem>
                {paymentAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.code ? `${a.code} · ` : ''}
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Used in Phase 5 when salary payment is enabled.</p>
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground">Salary expense account code</Label>
            <Input
              value={defaults.salaryExpenseAccountCode}
              onChange={(e) =>
                setDefaults((d) => ({ ...d, salaryExpenseAccountCode: e.target.value }))
              }
              className="bg-muted border-border text-foreground max-w-[120px]"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground">Commission expense account code</Label>
            <Input
              value={defaults.commissionExpenseAccountCode}
              onChange={(e) =>
                setDefaults((d) => ({ ...d, commissionExpenseAccountCode: e.target.value }))
              }
              className="bg-muted border-border text-foreground max-w-[120px]"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground">Staff payable account code</Label>
            <Input
              value={defaults.staffPayableAccountCode}
              onChange={(e) =>
                setDefaults((d) => ({ ...d, staffPayableAccountCode: e.target.value }))
              }
              className="bg-muted border-border text-foreground max-w-[120px]"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-4 pt-2">
          <div className="flex items-center gap-2">
            <Switch
              checked={defaults.requireApprovalBeforePost}
              onCheckedChange={(v) =>
                setDefaults((d) => ({ ...d, requireApprovalBeforePost: v }))
              }
            />
            <span className="text-sm text-muted-foreground">Require approval before GL post (Phase 4)</span>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={defaults.requireApprovalBeforePay}
              onCheckedChange={(v) =>
                setDefaults((d) => ({ ...d, requireApprovalBeforePay: v }))
              }
            />
            <span className="text-sm text-muted-foreground">Require approval before pay (Phase 5)</span>
          </div>
        </div>

        <Button
          onClick={() => void handleSaveDefaults()}
          disabled={savingDefaults}
          className="bg-purple-600 hover:bg-purple-700"
        >
          <Save className="w-4 h-4 mr-2" />
          {savingDefaults ? 'Saving…' : 'Save default settings'}
        </Button>
      </section>

      {/* Per-staff salary settings */}
      <section className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-6 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-foreground">Staff Salary Settings</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-border text-muted-foreground"
              onClick={() => void handleBackfill()}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Backfill from employees
            </Button>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => setAddOpen(true)}
            >
              Add staff
            </Button>
          </div>
        </div>

        {backfillResult != null && (
          <p className="px-6 py-2 text-xs text-muted-foreground border-b border-border">
            Last backfill inserted {backfillResult} row(s).
          </p>
        )}

        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Staff</TableHead>
              <TableHead>Basic salary</TableHead>
              <TableHead>Gen. day</TableHead>
              <TableHead>Salary</TableHead>
              <TableHead>Commission</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : staffRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No staff salary settings. Run backfill from employees or add staff.
                </TableCell>
              </TableRow>
            ) : (
              staffRows.map((row) => (
                <TableRow key={row.user_id} className="hover:bg-accent/30">
                  <TableCell>
                    <div className="font-medium text-foreground">
                      {row.user?.full_name ?? '—'}
                    </div>
                    <div className="text-xs text-muted-foreground">{row.user?.email}</div>
                  </TableCell>
                  <TableCell className="text-foreground">
                    {formatCurrency(Number(row.basic_monthly_salary) || 0)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {row.generation_day ?? `Default (${defaults.generationDay})`}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        row.salary_enabled
                          ? 'bg-green-500/10 text-[var(--erp-money-positive)] border-green-500/20'
                          : 'bg-gray-500/10 text-muted-foreground'
                      }
                    >
                      {row.salary_enabled ? 'On' : 'Off'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        row.commission_enabled
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          : 'bg-gray-500/10 text-muted-foreground'
                      }
                    >
                      {row.commission_enabled ? 'Existing sales' : 'Off'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {row.branch?.name ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        row.is_active
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-gray-500/10 text-muted-foreground'
                      }
                    >
                      {row.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-blue-400"
                      onClick={() => openEdit(row)}
                    >
                      <UserCog className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>

      {/* Legacy employee ledger — payment actions hidden in Phase 1 */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <DollarSign className="w-4 h-4" />
          Legacy employee ledger
        </h3>
        <EmployeesTab phase1HidePaymentActions />
      </section>

      {/* Edit staff dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit salary settings</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {editRow?.user?.full_name} — commission amounts are calculated by the existing sales
              engine, not here.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between">
              <Label>Salary enabled</Label>
              <Switch
                checked={editForm.salary_enabled}
                onCheckedChange={(v) => setEditForm((f) => ({ ...f, salary_enabled: v }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Basic monthly salary</Label>
              <Input
                type="number"
                value={editForm.basic_monthly_salary}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, basic_monthly_salary: e.target.value }))
                }
                className="bg-muted border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Generation day override (optional)</Label>
              <Input
                type="number"
                min={1}
                max={31}
                placeholder={`Default: ${defaults.generationDay}`}
                value={editForm.generation_day}
                onChange={(e) => setEditForm((f) => ({ ...f, generation_day: e.target.value }))}
                className="bg-muted border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Branch</Label>
              <Select
                value={editForm.branch_id}
                onValueChange={(v) => setEditForm((f) => ({ ...f, branch_id: v }))}
              >
                <SelectTrigger className="bg-muted border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-muted border-border text-foreground">
                  <SelectItem value={NONE}>— Any / company default —</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Default payment account</Label>
              <Select
                value={editForm.default_payment_account_id}
                onValueChange={(v) =>
                  setEditForm((f) => ({ ...f, default_payment_account_id: v }))
                }
              >
                <SelectTrigger className="bg-muted border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-muted border-border text-foreground">
                  <SelectItem value={NONE}>— Use company default —</SelectItem>
                  {paymentAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.code ? `${a.code} · ` : ''}
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Commission enabled (from sales)</Label>
              <Switch
                checked={editForm.commission_enabled}
                onCheckedChange={(v) => setEditForm((f) => ({ ...f, commission_enabled: v }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Advance salary allowed</Label>
              <Switch
                checked={editForm.advance_allowed}
                onCheckedChange={(v) => setEditForm((f) => ({ ...f, advance_allowed: v }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch
                checked={editForm.is_active}
                onCheckedChange={(v) => setEditForm((f) => ({ ...f, is_active: v }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                value={editForm.notes}
                onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                className="bg-muted border-border"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} className="border-border">
              Cancel
            </Button>
            <Button onClick={() => void handleSaveStaff()} disabled={savingStaff}>
              {savingStaff ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add staff dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle>Add staff to salary settings</DialogTitle>
          </DialogHeader>
          <Select value={addUserId} onValueChange={setAddUserId}>
            <SelectTrigger className="bg-muted border-border">
              <SelectValue placeholder="Select user" />
            </SelectTrigger>
            <SelectContent className="bg-muted border-border text-foreground">
              {usersWithoutSettings.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {(u as { full_name?: string }).full_name ?? u.email} ({u.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} className="border-border">
              Cancel
            </Button>
            <Button onClick={() => void handleAddStaff()} disabled={!addUserId}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
