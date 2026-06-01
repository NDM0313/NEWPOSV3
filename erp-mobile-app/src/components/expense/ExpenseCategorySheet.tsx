import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import * as expensesApi from '../../api/expenses';
import { TextInput } from '../common';

interface ExpenseCategorySheetProps {
  companyId: string;
  open: boolean;
  onClose: () => void;
  onTreeChanged: () => void;
}

export function ExpenseCategorySheet({
  companyId,
  open,
  onClose,
  onTreeChanged,
}: ExpenseCategorySheetProps) {
  const [tree, setTree] = useState<expensesApi.ExpenseCategoryTreeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const loadTree = useCallback(
    async (options?: { tryAutoSeed?: boolean }) => {
      setLoading(true);
      setLoadError(null);

      let { data, error: err } = await expensesApi.getExpenseCategoryTree(companyId);

      if (
        options?.tryAutoSeed !== false &&
        !err &&
        (data?.length ?? 0) === 0
      ) {
        const seed = await expensesApi.ensureDefaultExpenseCategories(companyId);
        if (seed.error) {
          setLoadError(seed.error);
        } else if (seed.created > 0) {
          const reload = await expensesApi.getExpenseCategoryTree(companyId);
          data = reload.data;
          err = reload.error;
        }
      }

      setLoading(false);
      if (err) {
        setLoadError(err);
        setTree([]);
      } else {
        setLoadError(null);
        setTree(data || []);
      }
    },
    [companyId],
  );

  useEffect(() => {
    if (open && companyId) void loadTree({ tryAutoSeed: true });
  }, [open, companyId, loadTree]);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setParentId('');
    setError(null);
  };

  const handleSetupDefaults = async () => {
    setSeeding(true);
    setError(null);
    const { created, error: seedErr } = await expensesApi.ensureDefaultExpenseCategories(companyId);
    setSeeding(false);
    if (seedErr) {
      setError(seedErr);
      return;
    }
    await loadTree({ tryAutoSeed: false });
    onTreeChanged();
    if (created > 0) {
      setError(null);
    }
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(
        parentId
          ? 'Enter tailor / dyer name (e.g. Ali, Zaid).'
          : 'Enter main category name (e.g. Stitching, Dying).',
      );
      return;
    }
    setSaving(true);
    setError(null);
    if (editingId) {
      const { error: err } = await expensesApi.updateExpenseCategory(editingId, {
        name: trimmed,
        parent_id: parentId || null,
      });
      setSaving(false);
      if (err) {
        setError(err);
        return;
      }
    } else {
      const { error: err } = await expensesApi.createExpenseCategory(companyId, {
        name: trimmed,
        parent_id: parentId || null,
      });
      setSaving(false);
      if (err) {
        setError(err);
        return;
      }
    }
    resetForm();
    await loadTree({ tryAutoSeed: false });
    onTreeChanged();
  };

  const handleEdit = (row: expensesApi.ExpenseCategoryRow) => {
    setEditingId(row.id);
    setName(row.name);
    setParentId(row.parent_id || '');
    setError(null);
  };

  const handleDelete = async (row: expensesApi.ExpenseCategoryRow) => {
    if (!window.confirm(`Delete category "${row.name}"?`)) return;
    setSaving(true);
    const { error: err } = await expensesApi.deleteExpenseCategory(row.id);
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    if (editingId === row.id) resetForm();
    await loadTree({ tryAutoSeed: false });
    onTreeChanged();
  };

  if (!open) return null;

  const mainOptions = tree.filter((m) => !m.parent_id);
  const showApiError = loadError && !loading;

  return (
    <div className="fixed inset-0 z-[100] bg-[#111827] flex flex-col">
      <div className="bg-gradient-to-br from-[#EF4444] to-[#DC2626] p-4 flex items-center gap-3">
        <button type="button" onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-white">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-semibold text-white">Expense categories</h1>
          <p className="text-xs text-white/80">Main categories + tailor names under Stitching / Dying</p>
        </div>
        <button type="button" onClick={onClose} className="p-2 text-white/80 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {showApiError && (
          <div className="p-3 bg-[#EF4444]/10 border border-[#EF4444]/50 rounded-xl text-[#EF4444] text-sm">
            {loadError}
          </div>
        )}

        {error && (
          <div className="p-3 bg-[#EF4444]/10 border border-[#EF4444]/50 rounded-xl text-[#EF4444] text-sm">
            {error}
          </div>
        )}

        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-[#D1D5DB]">
            {editingId ? 'Edit category' : 'Add category'}
          </p>
          <p className="text-xs text-[#6B7280] leading-relaxed">
            Parent <span className="text-[#9CA3AF]">blank</span> = main category (Stitching, Rent). Parent{' '}
            <span className="text-[#9CA3AF]">Stitching</span> + name Ali = tailor sub-category.
          </p>
          <TextInput
            value={name}
            onChange={setName}
            placeholder={parentId ? 'Tailor name (e.g. Ali)' : 'Main category (e.g. Stitching)'}
          />
          <div>
            <label className="block text-xs text-[#9CA3AF] mb-1">
              Under category (tailor ke liye — optional)
            </label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              disabled={mainOptions.length === 0 && !loading}
              className="w-full h-10 bg-[#111827] border border-[#374151] rounded-lg px-3 text-sm text-white disabled:opacity-50"
            >
              <option value="">None — new main category (e.g. Stitching, Dying)</option>
              {mainOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || seeding}
              className="flex-1 h-10 bg-[#EF4444] hover:bg-[#DC2626] disabled:opacity-50 rounded-lg text-white text-sm font-medium flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {editingId ? 'Save' : 'Add'}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 h-10 border border-[#374151] rounded-lg text-[#9CA3AF] text-sm"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 text-[#EF4444] animate-spin" />
          </div>
        ) : showApiError ? null : (
          <div className="space-y-3">
            {tree.map((main) => (
              <div key={main.id} className="bg-[#1F2937] border border-[#374151] rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#374151]">
                  <span className="text-sm font-semibold text-white">{main.name}</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => handleEdit(main)}
                      className="p-1.5 text-[#9CA3AF] hover:text-white"
                      aria-label="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(main)}
                      className="p-1.5 text-[#9CA3AF] hover:text-[#EF4444]"
                      aria-label="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {(main.children?.length ?? 0) > 0 ? (
                  <ul className="divide-y divide-[#374151]">
                    {main.children.map((sub) => (
                      <li key={sub.id} className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-sm text-[#D1D5DB]">{sub.name}</span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => handleEdit(sub)}
                            className="p-1.5 text-[#9CA3AF] hover:text-white"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(sub)}
                            className="p-1.5 text-[#9CA3AF] hover:text-[#EF4444]"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-4 py-3 text-xs text-[#6B7280]">No subcategories — add tailor names here.</p>
                )}
              </div>
            ))}
            {tree.length === 0 && (
              <div className="text-center py-6 space-y-3">
                <p className="text-sm text-[#9CA3AF]">
                  No categories in database yet. Load defaults (Stitching, Dying, Rent, …) or add a main category
                  above.
                </p>
                <button
                  type="button"
                  onClick={() => void handleSetupDefaults()}
                  disabled={seeding}
                  className="px-4 py-2.5 bg-[#EF4444] hover:bg-[#DC2626] disabled:opacity-50 rounded-lg text-white text-sm font-medium inline-flex items-center gap-2"
                >
                  {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Set up default categories
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
