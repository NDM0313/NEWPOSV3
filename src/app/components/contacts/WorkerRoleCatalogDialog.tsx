import React, { useCallback, useEffect, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
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
  DEFAULT_WORKER_ROLES,
  formatWorkerRoleOption,
  type WorkerRoleCategory,
  type WorkerRoleOption,
} from '@/app/lib/workerRoles';
import { workerRoleCatalogService } from '@/app/services/workerRoleCatalogService';

const CATEGORIES: WorkerRoleCategory[] = ['Dyeing', 'Stitching', 'Handwork'];

export interface WorkerRoleCatalogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  onCatalogChanged?: () => void;
}

export function WorkerRoleCatalogDialog({
  open,
  onOpenChange,
  companyId,
  onCatalogChanged,
}: WorkerRoleCatalogDialogProps) {
  const [customRoles, setCustomRoles] = useState<WorkerRoleOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<WorkerRoleOption | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editCategory, setEditCategory] = useState<WorkerRoleCategory>('Handwork');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const catalog = await workerRoleCatalogService.loadCatalog(companyId);
      setCustomRoles(catalog);
    } catch {
      setCustomRoles([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const startEdit = (role: WorkerRoleOption) => {
    setEditing(role);
    setEditLabel(role.label);
    setEditCategory(role.category);
  };

  const handleSaveEdit = async () => {
    if (!companyId || !editing) return;
    setSaving(true);
    try {
      await workerRoleCatalogService.updateCustomRole(companyId, editing.value, {
        label: editLabel,
        category: editCategory,
      });
      toast.success('Role updated');
      setEditing(null);
      await load();
      onCatalogChanged?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (value: string) => {
    if (!companyId) return;
    try {
      await workerRoleCatalogService.deleteCustomRole(companyId, value);
      toast.success('Role removed from catalog');
      await load();
      onCatalogChanged?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage worker roles</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Built-in (read-only)</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {DEFAULT_WORKER_ROLES.map((r) => (
                <li key={r.value} className="px-2 py-1 rounded bg-muted/40">
                  {formatWorkerRoleOption(r)}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Custom roles</p>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : customRoles.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No custom roles yet. Type a new name in the role dropdown to add one.
              </p>
            ) : (
              <ul className="space-y-2">
                {customRoles.map((role) => (
                  <li
                    key={role.value}
                    className="flex items-center justify-between gap-2 p-2 rounded bg-input-background border border-border"
                  >
                    <span className="text-sm">{formatWorkerRoleOption(role)}</span>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => startEdit(role)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                        onClick={() => void handleDelete(role.value)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {editing && (
          <div className="border-t border-border pt-4 space-y-3">
            <p className="text-sm font-medium text-[var(--erp-money-positive)]">Edit role</p>
            <div>
              <Label className="text-muted-foreground">Label</Label>
              <Input
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                className="bg-input-background border-border mt-1"
              />
            </div>
            <div>
              <Label className="text-muted-foreground">Category</Label>
              <Select
                value={editCategory}
                onValueChange={(v) => setEditCategory(v as WorkerRoleCategory)}
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
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void handleSaveEdit()} disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </DialogFooter>
          </div>
        )}

        {!editing && (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
