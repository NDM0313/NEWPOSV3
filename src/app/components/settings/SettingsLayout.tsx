import React, { useEffect, useState } from 'react';
import {
  Building2,
  Store,
  Calculator,
  Printer,
  Users,
  Server,
  ChevronRight,
  ChevronDown,
  Save,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';
import type { SettingsCategory, SettingsCategoryId } from './settingsNavigation';

const CATEGORY_ICONS: Record<SettingsCategoryId, LucideIcon> = {
  general: Building2,
  operations: Store,
  accountingFinance: Calculator,
  documentsPrinting: Printer,
  usersAccess: Users,
  systemData: Server,
};

interface SettingsLayoutProps {
  categories: SettingsCategory[];
  activeCategoryId: SettingsCategoryId;
  activeItemId: string;
  onSelect: (categoryId: SettingsCategoryId, itemId: string) => void;
  categoryDescription?: string;
  hasUnsavedChanges?: boolean;
  onSave?: () => void;
  children: React.ReactNode;
}

export function SettingsLayout({
  categories,
  activeCategoryId,
  activeItemId,
  onSelect,
  categoryDescription,
  hasUnsavedChanges,
  onSave,
  children,
}: SettingsLayoutProps) {
  const activeCategory = categories.find((c) => c.id === activeCategoryId);
  const activeItem = activeCategory?.items.find((i) => i.id === activeItemId);
  const [expandedCategoryId, setExpandedCategoryId] = useState<SettingsCategoryId | null>(activeCategoryId);

  useEffect(() => {
    setExpandedCategoryId(activeCategoryId);
  }, [activeCategoryId]);

  const toggleCategory = (categoryId: SettingsCategoryId) => {
    setExpandedCategoryId((prev) => (prev === categoryId ? null : categoryId));
  };

  return (
    <div className="min-h-screen bg-background text-foreground animate-in fade-in duration-500">
      <div className="sticky top-0 z-30 border-b border-border bg-background">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">
          <div className="flex justify-between items-start gap-4">
            <div>
              <h1 className="text-xl font-semibold text-foreground">Settings</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {activeItem?.label ?? 'Configure your ERP defaults and preferences'}
              </p>
              {categoryDescription ? (
                <p className="text-xs text-muted-foreground mt-1">{categoryDescription}</p>
              ) : null}
            </div>
            {hasUnsavedChanges && onSave ? (
              <Button
                onClick={onSave}
                className="bg-green-600 hover:bg-green-500 text-foreground gap-2 shadow-lg shrink-0"
              >
                <Save size={16} /> Save Changes
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        <div className="flex flex-col md:flex-row gap-6 min-h-[calc(100vh-8rem)]">
          <aside className="md:w-60 shrink-0 md:border-r md:border-border md:pr-4">
            <nav className="space-y-1" aria-label="Settings navigation">
              {categories.map((category) => {
                const Icon = CATEGORY_ICONS[category.id];
                const isActiveCategory = category.id === activeCategoryId;
                const isExpanded = expandedCategoryId === category.id;
                return (
                  <div key={category.id} className="rounded-lg border border-transparent">
                    <button
                      type="button"
                      onClick={() => toggleCategory(category.id)}
                      aria-expanded={isExpanded}
                      className={cn(
                        'w-full flex items-center justify-between gap-2 px-2 py-2.5 rounded-lg text-left transition-colors',
                        isActiveCategory
                          ? 'bg-muted text-primary'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                      )}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <Icon size={16} className="shrink-0" />
                        <span className="text-xs font-semibold uppercase tracking-wide truncate">
                          {category.label}
                        </span>
                      </span>
                      <ChevronDown
                        size={16}
                        className={cn(
                          'shrink-0 transition-transform duration-200',
                          isExpanded ? 'rotate-0' : '-rotate-90',
                        )}
                      />
                    </button>
                    {isExpanded ? (
                      <ul className="mt-0.5 mb-2 ml-2 pl-2 border-l border-border space-y-0.5">
                        {category.items.map((item) => {
                          const selected = activeCategoryId === category.id && activeItemId === item.id;
                          return (
                            <li key={item.id}>
                              <button
                                type="button"
                                onClick={() => onSelect(category.id, item.id)}
                                className={cn(
                                  'w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                                  selected
                                    ? 'bg-primary/20 text-foreground border border-primary/40'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/80 border border-transparent',
                                )}
                              >
                                <span className="truncate">{item.label}</span>
                                {selected ? <ChevronRight size={14} className="shrink-0 text-primary" /> : null}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </nav>
          </aside>

          <main className="flex-1 min-w-0">
            <div className="bg-card border border-border rounded-xl p-4 md:p-6 space-y-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
