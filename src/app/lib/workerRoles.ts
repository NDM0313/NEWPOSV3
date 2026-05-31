export type WorkerRoleCategory = 'Dyeing' | 'Stitching' | 'Handwork';

export interface WorkerRoleOption {
  value: string;
  label: string;
  category: WorkerRoleCategory;
  isCustom?: boolean;
}

export const DEFAULT_WORKER_ROLES: WorkerRoleOption[] = [
  { value: 'dyer', label: 'Dyer', category: 'Dyeing' },
  { value: 'tailor', label: 'Tailor', category: 'Stitching' },
  { value: 'stitching-master', label: 'Stitching Master', category: 'Stitching' },
  { value: 'cutter', label: 'Cutter', category: 'Stitching' },
  { value: 'hand-worker', label: 'Hand Worker', category: 'Handwork' },
  { value: 'helper', label: 'Helper / Labour', category: 'Handwork' },
  { value: 'embroidery', label: 'Embroidery', category: 'Handwork' },
];

const BUILTIN_VALUES = new Set(DEFAULT_WORKER_ROLES.map((r) => r.value));

export function isBuiltinWorkerRole(value: string): boolean {
  return BUILTIN_VALUES.has(value);
}

export function formatWorkerRoleOption(option: Pick<WorkerRoleOption, 'category' | 'label'>): string {
  return `${option.category} → ${option.label}`;
}

export function slugifyWorkerRole(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function humanizeSlug(value: string): string {
  return value
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function mergeWorkerRoles(
  catalog: WorkerRoleOption[],
  dbDistinct: string[],
): WorkerRoleOption[] {
  const byValue = new Map<string, WorkerRoleOption>();

  for (const role of DEFAULT_WORKER_ROLES) {
    byValue.set(role.value, { ...role, isCustom: false });
  }

  for (const role of catalog) {
    if (!role.value) continue;
    byValue.set(role.value, {
      value: role.value,
      label: role.label || humanizeSlug(role.value),
      category: role.category || 'Handwork',
      isCustom: true,
    });
  }

  for (const raw of dbDistinct) {
    const value = (raw || '').trim();
    if (!value || byValue.has(value)) continue;
    byValue.set(value, {
      value,
      label: humanizeSlug(value),
      category: 'Handwork',
      isCustom: true,
    });
  }

  return Array.from(byValue.values()).sort((a, b) => {
    const cat = a.category.localeCompare(b.category);
    if (cat !== 0) return cat;
    return a.label.localeCompare(b.label);
  });
}

export function getWorkerRoleOption(
  value: string,
  merged: WorkerRoleOption[],
): WorkerRoleOption | undefined {
  return merged.find((r) => r.value === value);
}

export function getWorkerRoleLabel(value: string, merged: WorkerRoleOption[]): string {
  const found = getWorkerRoleOption(value, merged);
  if (found) return formatWorkerRoleOption(found);
  if (!value) return '';
  return `Handwork → ${humanizeSlug(value)}`;
}

export function getWorkerRoleCategory(
  value: string,
  merged: WorkerRoleOption[],
): WorkerRoleCategory | undefined {
  return getWorkerRoleOption(value, merged)?.category;
}

/** Map Studio stage_type to WorkerRoleCategory for catalog lookups. */
export function stageTypeToCategory(
  stageType: 'dyer' | 'stitching' | 'handwork' | undefined,
): WorkerRoleCategory | undefined {
  if (stageType === 'dyer') return 'Dyeing';
  if (stageType === 'stitching') return 'Stitching';
  if (stageType === 'handwork') return 'Handwork';
  return undefined;
}

/** Whether a worker_role slug matches a Studio stage (built-ins + catalog category). */
export function workerRoleMatchesStage(
  workerRole: string,
  stageType: 'dyer' | 'stitching' | 'handwork' | undefined,
  merged: WorkerRoleOption[],
): boolean {
  if (!stageType) return true;
  const role = (workerRole || '').toLowerCase();

  let builtinMatch = false;
  if (stageType === 'dyer') {
    builtinMatch = role === 'dyer' || role === 'dyeing';
  } else if (stageType === 'stitching') {
    builtinMatch = ['tailor', 'stitching-master', 'cutter', 'stitching'].includes(role);
  } else if (stageType === 'handwork') {
    builtinMatch = ['hand-worker', 'helper', 'embroidery', 'handwork'].includes(role);
  }
  if (builtinMatch) return true;

  const category = getWorkerRoleCategory(workerRole, merged);
  const expected = stageTypeToCategory(stageType);
  return Boolean(category && expected && category === expected);
}
