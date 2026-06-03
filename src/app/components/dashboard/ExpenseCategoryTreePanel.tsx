import { useState } from 'react';
import { Plus, Pencil, Trash, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';
import type { ExpenseCategoryRow, ExpenseCategoryTreeItem } from '@/app/services/expenseCategoryService';
import {
  canAddSubcategory,
  countExpensesForNode,
  formatCategoryPathFromNodes,
  findPathToCategory,
} from '@/app/lib/expenseCategoryTreeUtils';

export interface ExpenseCategoryTreePanelProps {
  tree: ExpenseCategoryTreeItem[];
  operationalExpenses: Array<{ category?: string | null; expense_category_id?: string | null; amount?: number }>;
  /** When set, node counts and amounts use this subset (e.g. current month). */
  scopedExpenses?: Array<{ category?: string | null; expense_category_id?: string | null; amount?: number }>;
  iconBySlug: Record<string, React.ComponentType<{ size?: number }>>;
  defaultIcon: React.ComponentType<{ size?: number }>;
  onAddMain: () => void;
  onAddSub: (parentId: string, parentName: string) => void;
  onEdit: (row: ExpenseCategoryRow) => void;
  onDelete: (row: ExpenseCategoryRow & { count?: number; children?: ExpenseCategoryTreeItem[] }) => void;
}

function sumAmountForNode(
  expenses: ExpenseCategoryTreePanelProps['operationalExpenses'],
  node: ExpenseCategoryTreeItem,
): number {
  return expenses
    .filter((e) => {
      const id = String(e.expense_category_id || '').trim();
      if (id && id === node.id) return true;
      return (e.category || '').trim() === node.name;
    })
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);
}

function CategoryTreeRows({
  nodes,
  tree,
  depthStart,
  countExpenses,
  sumAmount,
  expandedIds,
  onToggleExpand,
  onAddSub,
  onEdit,
  onDelete,
}: {
  nodes: ExpenseCategoryTreeItem[];
  tree: ExpenseCategoryTreeItem[];
  depthStart: number;
  countExpenses: ExpenseCategoryTreePanelProps['operationalExpenses'];
  sumAmount: (node: ExpenseCategoryTreeItem) => number;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onAddSub: ExpenseCategoryTreePanelProps['onAddSub'];
  onEdit: ExpenseCategoryTreePanelProps['onEdit'];
  onDelete: ExpenseCategoryTreePanelProps['onDelete'];
}) {
  const renderNode = (node: ExpenseCategoryTreeItem, depth: number) => {
    const path = findPathToCategory(tree, node.id) ?? [node];
    const pathLabel = formatCategoryPathFromNodes(path);
    const nodeCount = countExpensesForNode(countExpenses, node);
    const nodeAmount = sumAmount(node);
    const hasChildren = (node.children?.length ?? 0) > 0;
    const expanded = expandedIds.has(node.id);
    const showSubBtn = canAddSubcategory(depth);
    const pl = 20 + depth * 20;

    return (
      <li key={node.id}>
        <div
          className="flex items-center justify-between gap-3 py-3 border-b border-gray-800/60 last:border-b-0"
          style={{ paddingLeft: pl, paddingRight: 20 }}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {hasChildren ? (
              <button
                type="button"
                onClick={() => onToggleExpand(node.id)}
                className="shrink-0 p-0.5 text-gray-500 hover:text-white"
                aria-label={expanded ? 'Collapse' : 'Expand'}
              >
                <ChevronRight
                  size={16}
                  className={cn('transition-transform', expanded && 'rotate-90')}
                />
              </button>
            ) : (
              <span className="w-5 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-sm text-gray-200">
                {depth > 0 ? <span className="text-gray-500 mr-2">↳</span> : null}
                {pathLabel}
              </p>
              <p className="text-xs text-gray-500" style={{ marginLeft: depth > 0 ? 20 : 0 }}>
                {nodeCount} expense{nodeCount === 1 ? '' : 's'}
                {nodeAmount > 0 ? ` · Rs. ${nodeAmount.toLocaleString()}` : ''}
              </p>
            </div>
          </div>
          <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            {showSubBtn ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAddSub(node.id, pathLabel)}
                className="h-8 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-900/20"
              >
                <Plus size={12} className="mr-1" />
                Sub
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(node)}
              className="h-8 w-8 text-gray-500 hover:text-white"
            >
              <Pencil size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete({ ...node, count: nodeCount, children: node.children })}
              className="h-8 w-8 text-gray-500 hover:text-red-400"
            >
              <Trash size={14} />
            </Button>
          </div>
        </div>
        {hasChildren && expanded ? (
          <ul>{node.children.map((child) => renderNode(child, depth + 1))}</ul>
        ) : null}
      </li>
    );
  };

  return (
    <ul className="divide-y divide-gray-800/60">
      {nodes.map((node) => renderNode(node, depthStart))}
    </ul>
  );
}

export function ExpenseCategoryTreePanel({
  tree,
  operationalExpenses,
  scopedExpenses,
  iconBySlug,
  defaultIcon,
  onAddMain,
  onAddSub,
  onEdit,
  onDelete,
}: ExpenseCategoryTreePanelProps) {
  const countExpenses = scopedExpenses ?? operationalExpenses;
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (tree.length === 0) {
    return (
      <button
        type="button"
        onClick={onAddMain}
        className="border border-dashed border-gray-800 rounded-xl p-8 flex flex-col items-center justify-center gap-3 text-gray-500 hover:text-white hover:border-gray-600 hover:bg-gray-900/30 transition-all w-full min-h-[160px]"
      >
        <div className="w-12 h-12 rounded-full bg-gray-900 flex items-center justify-center">
          <Plus size={24} />
        </div>
        <span className="font-medium">Add your first category</span>
      </button>
    );
  }

  return (
    <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
      {tree.map((main) => {
        const Icon = iconBySlug[main.icon] || defaultIcon;
        const colorClass = main.color?.startsWith('bg-')
          ? main.color
          : `bg-${main.color || 'gray'}-500`;
        const hasChildren = (main.children?.length ?? 0) > 0;
        const mainExpanded = expandedIds.has(main.id);
        const mainCount = countExpensesForNode(countExpenses, main);
        const mainAmount = sumAmountForNode(countExpenses, main);

        return (
          <div
            key={main.id}
            className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition-colors"
          >
            <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-800/80">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                {hasChildren ? (
                  <button
                    type="button"
                    onClick={() => toggleExpand(main.id)}
                    className="mt-1 shrink-0 p-1 text-gray-500 hover:text-white"
                    aria-label={mainExpanded ? 'Collapse' : 'Expand'}
                  >
                    <ChevronRight
                      size={18}
                      className={cn('transition-transform', mainExpanded && 'rotate-90')}
                    />
                  </button>
                ) : null}
                <div className="p-3 bg-gray-950 rounded-lg border border-gray-800 text-gray-400 shrink-0">
                  <Icon size={24} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-lg truncate">{main.name}</h3>
                    <div className={cn('w-2 h-2 rounded-full shrink-0', colorClass)} />
                  </div>
                  <p className="text-sm text-gray-500">
                    Main category · {mainCount} this month
                    {mainAmount > 0 ? ` · Rs. ${mainAmount.toLocaleString()}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                {canAddSubcategory(0) ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onAddSub(main.id, main.name)}
                    className="h-8 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-900/20"
                  >
                    <Plus size={12} className="mr-1" />
                    Subcategory
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(main)}
                  className="h-8 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs"
                >
                  <Pencil size={12} className="mr-1" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete({ ...main, children: main.children })}
                  className="h-8 bg-red-900/10 hover:bg-red-900/20 text-red-400 hover:text-red-300 px-2"
                >
                  <Trash size={12} />
                </Button>
              </div>
            </div>

            {hasChildren && mainExpanded ? (
              <CategoryTreeRows
                nodes={main.children}
                tree={tree}
                depthStart={1}
                countExpenses={countExpenses}
                sumAmount={(node) => sumAmountForNode(countExpenses, node)}
                expandedIds={expandedIds}
                onToggleExpand={toggleExpand}
                onAddSub={onAddSub}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ) : hasChildren ? (
              <p className="px-5 py-3 text-xs text-gray-500">
                {main.children.length} subcategories — expand to view
              </p>
            ) : (
              <p className="px-5 py-3 text-xs text-gray-500">
                No subcategories — use Subcategory to add types (e.g. Dying) or tailor names under{' '}
                {main.name}.
              </p>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={onAddMain}
        className="border border-dashed border-gray-800 rounded-xl p-5 flex flex-col items-center justify-center gap-3 text-gray-500 hover:text-white hover:border-gray-600 hover:bg-gray-900/30 transition-all min-h-[120px] w-full"
      >
        <div className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center">
          <Plus size={20} />
        </div>
        <span className="font-medium text-sm">Add main category</span>
      </button>
    </div>
  );
}
