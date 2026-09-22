import React, { useCallback, useEffect, useState } from 'react';
import { Check, ChevronsUpDown, Loader2, Plus, Settings2 } from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { Button } from '@/app/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/app/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Label } from '@/app/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { toast } from 'sonner';
import {
  formatWorkerRoleOption,
  getWorkerRoleLabel,
  type WorkerRoleCategory,
  type WorkerRoleOption,
} from '@/app/lib/workerRoles';
import { workerRoleCatalogService } from '@/app/services/workerRoleCatalogService';
import { WorkerRoleCatalogDialog } from './WorkerRoleCatalogDialog';

const CATEGORIES: WorkerRoleCategory[] = ['Dyeing', 'Stitching', 'Handwork'];

export interface WorkerRoleComboboxProps {
  companyId: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function WorkerRoleCombobox({
  companyId,
  value,
  onChange,
  disabled,
  className,
}: WorkerRoleComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roles, setRoles] = useState<WorkerRoleOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingLabel, setPendingLabel] = useState('');
  const [pendingCategory, setPendingCategory] = useState<WorkerRoleCategory>('Handwork');
  const [savingNew, setSavingNew] = useState(false);

  const loadRoles = useCallback(async () => {
    if (!companyId) {
      setRoles([]);
      return;
    }
    setLoading(true);
    try {
      const merged = await workerRoleCatalogService.loadMergedRoles(companyId);
      setRoles(merged);
    } catch {
      setRoles([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  const filtered = searchTerm.trim()
    ? roles.filter((r) => {
        const q = searchTerm.toLowerCase();
        return (
          r.label.toLowerCase().includes(q)
          || r.category.toLowerCase().includes(q)
          || r.value.toLowerCase().includes(q)
          || formatWorkerRoleOption(r).toLowerCase().includes(q)
        );
      })
    : roles;

  const trimmedSearch = searchTerm.trim();
  const canAddNew =
    trimmedSearch.length > 0
    && !roles.some(
      (r) =>
        r.label.toLowerCase() === trimmedSearch.toLowerCase()
        || r.value === trimmedSearch.toLowerCase().replace(/\s+/g, '-'),
    );

  const handleStartCreate = () => {
    setPendingLabel(trimmedSearch);
    setPendingCategory('Handwork');
    setCreateOpen(true);
  };

  const handleConfirmCreate = async () => {
    if (!companyId || !pendingLabel.trim()) return;
    setSavingNew(true);
    try {
      const created = await workerRoleCatalogService.saveCustomRole(companyId, {
        label: pendingLabel.trim(),
        category: pendingCategory,
      });
      await loadRoles();
      onChange(created.value);
      setCreateOpen(false);
      setOpen(false);
      setSearchTerm('');
      toast.success(`Role "${created.label}" added`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not save role');
    } finally {
      setSavingNew(false);
    }
  };

  const displayLabel = value ? getWorkerRoleLabel(value, roles) : 'Select role...';

  return (
    <>
      <div className="space-y-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              disabled={disabled || loading}
              className={cn(
                'w-full justify-between bg-card border-border text-foreground hover:bg-muted h-9',
                className,
              )}
            >
              <span className="truncate text-sm">
                {loading ? 'Loading roles…' : displayLabel}
              </span>
              {loading ? (
                <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin opacity-50" />
              ) : (
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0 bg-input-background border-border text-foreground z-[250]"
            align="start"
          >
            <Command shouldFilter={false} className="bg-input-background text-foreground">
              <CommandInput
                placeholder="Search or type new role…"
                value={searchTerm}
                onValueChange={setSearchTerm}
                className="h-9"
              />
              <CommandList className="max-h-[240px]">
                {canAddNew && (
                  <div className="p-2 border-b border-border">
                    <button
                      type="button"
                      onClick={handleStartCreate}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-[var(--erp-money-positive)] bg-green-500/10 hover:bg-green-500/20 rounded-lg border border-green-500/20"
                    >
                      <Plus className="h-4 w-4 shrink-0" />
                      Add &quot;{trimmedSearch}&quot;…
                    </button>
                  </div>
                )}
                {filtered.length === 0 && !canAddNew && (
                  <CommandEmpty>No roles found.</CommandEmpty>
                )}
                {filtered.length > 0 && (
                  <CommandGroup>
                    {filtered.map((role) => (
                      <CommandItem
                        key={role.value}
                        value={role.value}
                        onSelect={() => {
                          onChange(role.value);
                          setOpen(false);
                          setSearchTerm('');
                        }}
                        className="text-foreground hover:bg-muted cursor-pointer"
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4 shrink-0',
                            value === role.value ? 'opacity-100' : 'opacity-0',
                          )}
                        />
                        {formatWorkerRoleOption(role)}
                        {role.isCustom && (
                          <span className="ml-auto text-[10px] text-muted-foreground">custom</span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <button
          type="button"
          onClick={() => setManageOpen(true)}
          className="text-xs text-muted-foreground hover:text-[var(--erp-money-positive)] flex items-center gap-1"
        >
          <Settings2 className="h-3 w-3" />
          Manage roles
        </button>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-sm">
          <DialogHeader>
            <DialogTitle>Add worker role</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-muted-foreground">Role name</Label>
              <p className="mt-1 text-sm text-foreground font-medium">{pendingLabel}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Studio category</Label>
              <Select
                value={pendingCategory}
                onValueChange={(v) => setPendingCategory(v as WorkerRoleCategory)}
              >
                <SelectTrigger className="bg-input-background border-border mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-input-background border-border">
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c} className="text-foreground focus:bg-muted">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Used for Studio task assignment (Dyeing / Stitching / Handwork).
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleConfirmCreate()} disabled={savingNew}>
              {savingNew ? 'Saving…' : 'Save role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WorkerRoleCatalogDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        companyId={companyId}
        onCatalogChanged={() => void loadRoles()}
      />
    </>
  );
}
